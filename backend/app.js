    // --- DEPENDENCIES ---
    const express = require('express');
    const mqtt = require('mqtt');
    const bodyParser = require('body-parser');

    // --- KONFIGURASI SERVER ---
    const app = express();
    const port = 4000;

    // Middleware untuk mem-parsing JSON dari body request
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // --- KONFIGURASI MQTT ---
    // Ganti dengan IP lokal PC Anda (tempat Broker MQTT berjalan)
    // Jika Anda menggunakan Docker dan menargetkan host PC, gunakan IP lokal Anda di sini
    const MQTT_BROKER_HOST = '127.0.0.1'; 
    const MQTT_PORT = 1883;

    // Topic yang akan di-publish/dikirim ke ESP8266
    const PUBLISH_TOPIC = 'lamp';

    // --- INISIALISASI KONEKSI MQTT ---
    const client = mqtt.connect(`mqtt://${MQTT_BROKER_HOST}:${MQTT_PORT}`);

    client.on('connect', () => {
        console.log('Terhubung ke Broker MQTT');
        
        // Opsional: Berlangganan ke topik 'response' (jika ESP8266 mengirim balik status)
        // client.subscribe('response'); 
    });

    client.on('error', (err) => {
        console.error(`Koneksi MQTT Gagal: ${err.message}`);
        // Coba sambungkan kembali setelah beberapa waktu
        setTimeout(() => {
            client.reconnect();
        }, 5000); 
    });

    // --- DEFINISI ROUTE HTTP (API ENDPOINT) ---

    /**
     * Endpoint GET sederhana untuk memeriksa status kesehatan (Health Check) server.
     * Ini memeriksa apakah Express berjalan dan apakah koneksi ke Broker MQTT aktif.
     */
    app.get('/api/health', (req, res) => {
        const isMqttConnected = client.connected;
        
        if (isMqttConnected) {
            res.status(200).json({ 
                status: 'ok', 
                service: 'Express API Gateway',
                mqtt_status: 'Connected',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({ 
                status: 'error', 
                service: 'Express API Gateway',
                mqtt_status: 'Disconnected',
                timestamp: new Date().toISOString(),
                error_details: 'Failed to connect to MQTT broker.'
            });
        }
    });


    /**
     * Endpoint POST untuk memublikasikan status ke topik MQTT.
     * Contoh Body JSON: {"status": "on"} atau {"status": "off"}
     */
    app.post('/api/publish/:topic', (req, res) => {
        const topic = req.params.topic;
        const { status } = req.body;
        
        if (!status || (status.toLowerCase() !== 'on' && status.toLowerCase() !== 'off')) {
            return res.status(400).json({ error: 'Permintaan tidak valid. Diperlukan body JSON: {"status": "on" atau "off"}' });
        }

        if (!client.connected) {
            return res.status(503).json({ error: 'Broker MQTT tidak terhubung. Coba lagi.' });
        }

        // Payload JSON yang dikirim ke ESP8266 (misal: '{"status":"on"}')
        const payload = JSON.stringify({
            topic: topic, 
            status: status.toUpperCase() 
        });

        // Kirim pesan ke Broker MQTT
        client.publish(topic, payload, (err) => {
            if (err) {
                console.error(`Gagal memublikasikan pesan ke ${topic}: ${err}`);
                return res.status(500).json({ error: 'Gagal mengirim pesan MQTT.' });
            }
            
            console.log(`[Express -> MQTT] Publikasi pesan ke topik '${topic}': ${payload}`);
            res.json({ message: 'Command succes to  via MQTT', topic: topic, status: status.toUpperCase() });
        });
    });


    // --- JALANKAN SERVER EXPRESS ---
    app.listen(port, () => {
        console.log(`Server Express berjalan di http://localhost:${port}`);
        console.log("Pastikan IP ini sama dengan mqtt_server di kode Arduino Anda!");
    });

    // Catatan: Anda perlu menginstal dependencies ini:
    // npm install express mqtt body-parser
