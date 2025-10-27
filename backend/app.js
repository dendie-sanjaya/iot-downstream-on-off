const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');

// --- Konfigurasi MQTT ---
// Ganti dengan detail broker MQTT Anda
const MQTT_BROKER_URL = 'mqtt://127.0.0.1:1883'; 
const MQTT_TOPIC = 'lamp'; 

// Membuat instance klien MQTT dan terhubung
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on('connect', () => {
    console.log('✅ Connected to Broker MQTT');
});

mqttClient.on('error', (error) => {
    console.error('🛑 Kesalahan koneksi MQTT:', error);
});

// --- Konfigurasi Express ---
const app = express();
const PORT = 4000;

// Middleware untuk mengurai body request sebagai JSON
app.use(bodyParser.json());

// =======================================================
// [ENDPOINT 1] HEALTH CHECK
// =======================================================
app.get('/health', (req, res) => {
    const isMqttConnected = mqttClient.connected;
    
    // Status HTTP 200 jika semua komponen berjalan
    if (isMqttConnected) {
        res.status(200).json({
            status: 'ok',
            service: 'Express API Gateway',
            mqtt_connection: 'connected',
            timestamp: new Date().toISOString()
        });
    } else {
        // Status HTTP 503 Service Unavailable jika ada dependensi vital (MQTT) yang gagal
        res.status(503).json({
            status: 'error',
            service: 'Express API Gateway',
            mqtt_connection: 'disconnected',
            message: 'Gagal terhubung ke Broker MQTT. Mohon periksa broker dan konfigurasi.'
        });
    }
});


// =======================================================
// [ENDPOINT 2] PUBLISH KE MQTT
// =======================================================
app.post('/api/publish/lamp', (req, res) => {
    // Pastikan koneksi MQTT sudah siap
    if (!mqttClient.connected) {
        // Jika klien MQTT tidak terhubung, kirim 503
        return res.status(503).json({ 
            status: 'error', 
            message: 'Klien MQTT belum terhubung. Coba endpoint /health untuk detail.' 
        });
    }
    
    // Mendapatkan data dari body request
    const { status } = req.body; 

    // Validasi data
    if (!status || (status.toLowerCase() !== 'on' && status.toLowerCase() !== 'off')) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Payload JSON tidak valid. Diperlukan {"status": "on" atau "off"}' 
        });
    }

    // Objek JSON yang akan dikirim
    const payload = {
        topic: MQTT_TOPIC,
        status: status.toUpperCase() // Mengubah ke ON/OFF untuk konsistensi
    };
    
    // Mengubah objek JSON menjadi string
    const message = JSON.stringify(payload);
    console.log(`Mempersiapkan untuk memublikasikan pesan: ${message}`);

    // Memublikasikan pesan ke topik MQTT
    mqttClient.publish(MQTT_TOPIC, message, { qos: 0 }, (err) => {
        if (err) {
            console.error('🛑 Gagal memublikasikan pesan:', err);
            return res.status(500).json({ 
                status: 'error', 
                message: 'Failed publish message to MQTT.' 
            });
        }
        
        console.log(`✅ Pesan dipublikasikan ke ${MQTT_TOPIC}: ${message}`);
        // Kirim respons SUKSES kembali ke Postman
        res.status(200).json({ 
            status: 'success', 
            message: `comman success publish to  ${MQTT_TOPIC}`,
            payload: payload
        });
    });
});

// Menjalankan server Express
app.listen(PORT, () => {
    console.log(`Server Express berjalan di http://localhost:${PORT}`);
    console.log(`Cek Health: http://localhost:${PORT}/health`);
});
