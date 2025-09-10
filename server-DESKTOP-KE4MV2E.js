const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuración de SQL Server
const config = {
    server: 'stecno.dyndns.org',
    port: 1433, // Puerto estándar de SQL Server
    user: 'sa',
    password: 'Sintesis2018*',
    database: 'etica',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 60000, // Aumenté a 60 segundos
        connectionTimeout: 60000, // Aumenté a 60 segundos
        connectTimeout: 60000,
        parseJSON: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000
    }
};

// Configuración de multer para archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /pdf|png|jpg|jpeg|doc|docx|xls|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'));
        }
    }
});

// Conectar a SQL Server
let pool;
let isConnected = false;

async function connectDB() {
    try {
        console.log('Intentando conectar a SQL Server...');
        console.log('Servidor:', config.server);
        console.log('Base de datos:', config.database);
        console.log('Usuario:', config.user);
        
        pool = await sql.connect(config);
        isConnected = true;
        console.log('Conectado exitosamente a SQL Server');
        
        // Manejar eventos de conexión
        pool.on('error', err => {
            console.error('Error en la conexión de SQL Server:', err);
            isConnected = false;
        });
        
        // Probar la conexión con una consulta simple
        const testResult = await pool.request().query('SELECT 1 as test');
        console.log('Prueba de consulta exitosa:', testResult.recordset);
        
    } catch (err) {
        console.error('Error conectando a la base de datos:');
        console.error('Código de error:', err.code);
        console.error('Mensaje:', err.message);
        console.error('Detalles completos:', err);
        
        isConnected = false;
        
        // Reintentar conexión después de 10 segundos (aumenté el tiempo)
        console.log('🔄 Reintentando conexión en 10 segundos...');
        setTimeout(connectDB, 10000);
    }
}

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API para enviar reporte
app.post('/api/submit-report', upload.array('attachments', 5), async (req, res) => {
    try {
        // Verificar que la conexión esté disponible
        if (!pool || !isConnected) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error de conexión a la base de datos. Intente nuevamente.' 
            });
        }

        const {
            name,
            email,
            phone,
            company,
            position,
            area,
            type,
            subject,
            message,
            anonymous,
            puntos_venta,
            incident_date
        } = req.body;

        // Procesar archivos adjuntos
        let attachmentUrls = [];
        if (req.files && req.files.length > 0) {
            attachmentUrls = req.files.map(file => `/uploads/${file.filename}`);
        }

        const request = pool.request();
        
        await request
            .input('id', sql.UniqueIdentifier, uuidv4())
            .input('name', sql.NVarChar, anonymous === 'true' ? null : name)
            .input('email', sql.NVarChar, anonymous === 'true' ? null : email)
            .input('phone', sql.NVarChar, anonymous === 'true' ? null : phone)
            .input('company', sql.NVarChar, company)
            .input('position', sql.NVarChar, position)
            .input('area', sql.NVarChar, area)
            .input('type', sql.NVarChar, type)
            .input('subject', sql.NVarChar, subject)
            .input('message', sql.NVarChar, message)
            .input('anonymous', sql.Bit, anonymous === 'true')
            .input('attachment_urls', sql.NVarChar, JSON.stringify(attachmentUrls))
            .input('puntos_venta', sql.NVarChar, puntos_venta)
            .input('incident_date', sql.Date, incident_date || null)
            .query(`
                INSERT INTO feedback 
                (id, name, email, phone, company, position, area, type, subject, message, anonymous, attachment_urls, puntos_venta, incident_date)
                VALUES 
                (@id, @name, @email, @phone, @company, @position, @area, @type, @subject, @message, @anonymous, @attachment_urls, @puntos_venta, @incident_date)
            `);

        res.json({ 
            success: true, 
            message: 'Reporte enviado exitosamente',
            reportId: request.parameters.id.value
        });

    } catch (err) {
        console.error('Error al enviar reporte:', err);
        
        // Si es un error de conexión, intentar reconectar
        if (err.code === 'ENOTOPEN' || err.code === 'ECONNCLOSED') {
            isConnected = false;
            connectDB();
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor' 
        });
    }
});

// Servir archivos estáticos de uploads
app.use('/uploads', express.static('uploads'));

// Iniciar servidor
app.listen(PORT, async () => {
    console.log(`Servidor iniciando en http://localhost:${PORT}`);
    await connectDB();
    console.log(`Servidor listo en http://localhost:${PORT}`);
});

// Manejo de errores de conexión
process.on('SIGINT', async () => {
    if (pool) {
        await pool.close();
    }
    process.exit(0);
});

// Ruta para probar la conexión a la base de datos
app.get('/api/test-connection', async (req, res) => {
    try {
        if (!pool || !isConnected) {
            return res.status(500).json({
                success: false,
                message: 'No hay conexión activa a la base de datos',
                connected: false
            });
        }

        // Probar con una consulta simple
        const result = await pool.request().query('SELECT GETDATE() as current_time, DB_NAME() as database_name');
        
        res.json({
            success: true,
            message: 'Conexión exitosa',
            connected: true,
            data: result.recordset[0]
        });
        
    } catch (err) {
        console.error('Error en test de conexión:', err);
        res.status(500).json({
            success: false,
            message: 'Error al probar la conexión',
            error: err.message,
            connected: false
        });
    }
});