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
    server: process.env.DB_SERVER || 'stecno.dyndns.org',
    port: parseInt(process.env.DB_PORT) || 1433, // Puerto estándar de SQL Server
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Sintesis2018*',
    database: process.env.DB_DATABASE || 'etica',
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

        console.log('=== DATOS RECIBIDOS EN EL SERVIDOR ===');
        console.log('req.body completo:', req.body);
        console.log('Archivos recibidos:', req.files);

        const {
            name,
            email,
            phone,
            company,
            position,
            situation_relation,
            area,
            type,
            subject,
            message,
            anonymous,
            puntos_venta,
            incident_date,
            incident_date_initial,
            incident_date_end
        } = req.body;

        // Mover estas líneas aquí:
        console.log('incident_date:', incident_date);
        console.log('incident_date_initial:', incident_date_initial);
        console.log('incident_date_end:', incident_date_end);

        console.log('=== ANÁLISIS DEL CAMPO SITUATION_RELATION ===');
        console.log('Valor raw:', situation_relation);
        console.log('Tipo:', typeof situation_relation);
        console.log('Es undefined:', situation_relation === undefined);
        console.log('Es null:', situation_relation === null);
        console.log('Es string vacío:', situation_relation === '');
        console.log('Es falsy:', !situation_relation);
        
        // Validación estricta del campo situation_relation
        if (situation_relation === undefined || situation_relation === null || situation_relation === '' || !situation_relation.toString().trim()) {
            console.log('RECHAZANDO: situation_relation es inválido');
            return res.status(400).json({
                success: false,
                message: 'El campo "¿Qué relación tiene con la situación expuesta?" es requerido y no puede estar vacío'
            });
        }
        
        const cleanSituationRelation = situation_relation.toString().trim();
        console.log('situation_relation limpio:', cleanSituationRelation);

        // Procesar archivos adjuntos
        let attachmentUrls = [];
        if (req.files && req.files.length > 0) {
            attachmentUrls = req.files.map(file => `/uploads/${file.filename}`);
        }

        const request = pool.request();
        
        const reportId = uuidv4();
        
        console.log('=== PREPARANDO INSERCIÓN EN BD ===');
        console.log('situation_relation que se insertará:', cleanSituationRelation);
        
        await request
            .input('id', sql.UniqueIdentifier, reportId)
            .input('name', sql.NVarChar, (anonymous === 'true' || anonymous === true) ? null : (name || null))
            .input('email', sql.NVarChar, (anonymous === 'true' || anonymous === true) ? null : (email || null))
            .input('phone', sql.NVarChar, (anonymous === 'true' || anonymous === true) ? null : (phone || null))
            .input('company', sql.NVarChar, company || null)
            .input('position', sql.NVarChar, position || null)
            .input('situation_relation', sql.NVarChar, cleanSituationRelation)
            .input('area', sql.NVarChar, area || null)
            .input('type', sql.NVarChar, type || null)
            .input('subject', sql.NVarChar, subject || null)
            .input('message', sql.NVarChar, message || null)
            .input('anonymous', sql.Bit, anonymous === 'true' || anonymous === true)
            .input('attachment_urls', sql.NVarChar, JSON.stringify(attachmentUrls))
            .input('puntos_venta', sql.NVarChar, puntos_venta || null)
            .input('incident_date', sql.Date, incident_date ? new Date(incident_date) : null)
            .input('incident_date_initial', sql.Date, incident_date_initial ? new Date(incident_date_initial) : null)
            .input('incident_date_end', sql.Date, incident_date_end ? new Date(incident_date_end) : null)
            .query(`
                INSERT INTO feedback 
                (id, name, email, phone, company, position, situation_relation, area, type, subject, message, anonymous, attachment_urls, puntos_venta, incident_date, incident_date_initial, incident_date_end)
                VALUES 
                (@id, @name, @email, @phone, @company, @position, @situation_relation, @area, @type, @subject, @message, @anonymous, @attachment_urls, @puntos_venta, @incident_date, @incident_date_initial, @incident_date_end)
            `);

        console.log('Reporte guardado exitosamente con ID:', reportId);

        res.json({ 
            success: true, 
            message: 'Reporte enviado exitosamente',
            reportId: reportId
        });

    } catch (err) {
        console.error('ERROR COMPLETO AL ENVIAR REPORTE:');
        console.error('Mensaje de error:', err.message);
        console.error('Código de error:', err.code);
        console.error('Número de error:', err.number);
        console.error('Stack trace:', err.stack);
        
        // Si es un error de conexión, intentar reconectar
        if (err.code === 'ENOTOPEN' || err.code === 'ECONNCLOSED') {
            isConnected = false;
            connectDB();
        }
        
        // Error específico para campo NULL
        if (err.number === 515 && err.message.includes('situation_relation')) {
            return res.status(400).json({
                success: false,
                message: 'Error: El campo "¿Qué relación tiene con la situación expuesta?" no puede estar vacío. Por favor seleccione una opción.'
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Error interno del servidor. Por favor, intente nuevamente.'
        });
    }
});

// Ruta para obtener todos los reportes
app.get('/api/reports', async (req, res) => {
    try {
        if (!isConnected) {
            await connectDB();
        }

        const result = await pool.request().query(`
            SELECT 
                id,
                name,
                email,
                phone,
                company,
                position,
                situation_relation,
                area,
                type as tipo,
                subject as asunto,
                message as mensaje,
                anonymous,
                attachment_urls,
                puntos_venta as punto_venta,
                incident_date as fecha_incidente,
                incident_date_initial as fecha_incidente_inicial,
                incident_date_end as fecha_incidente_final,
                created_at as fecha,
                'Pendiente' as estado
            FROM feedback 
            ORDER BY created_at DESC
        `);
        
        console.log('Datos obtenidos de la base de datos:', result.recordset.length, 'registros');

        // Procesar los datos para el formato esperado
        const processedData = result.recordset.map(record => {
            let attachmentUrls = [];
            try {
                if (record.attachment_urls) {
                    attachmentUrls = JSON.parse(record.attachment_urls);
                }
            } catch (e) {
                console.error('Error parsing attachment_urls:', e);
            }

            return {
                ...record,
                attachment_urls: attachmentUrls,
                fecha: record.fecha ? record.fecha.toISOString().split('T')[0] : null,
                fecha_incidente: record.fecha_incidente ? record.fecha_incidente.toISOString().split('T')[0] : null
            };
        });

        res.json({
            success: true,
            reports: processedData
        });

    } catch (error) {
        console.error('Error obteniendo reportes:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo reportes de la base de datos'
        });
    }
});

// Ruta para obtener todos los reportes de feedback
app.get('/api/feedback', async (req, res) => {
    try {
        if (!pool || !isConnected) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error de conexión a la base de datos' 
            });
        }

        const request = pool.request();
        const result = await request.query(`
            SELECT 
                id,
                name,
                email,
                phone,
                company,
                position,
                situation_relation,
                area,
                type,
                subject,
                message,
                anonymous,
                attachment_urls,
                puntos_venta,
                incident_date,
                incident_date_initial,
                incident_date_end,
                created_at
            FROM feedback 
            ORDER BY created_at DESC
        `);

        // Procesar los datos para parsear attachment_urls
        const feedbackData = result.recordset.map(record => {
            let attachments = [];
            try {
                if (record.attachment_urls) {
                    attachments = JSON.parse(record.attachment_urls);
                }
            } catch (e) {
                console.error('Error parsing attachment_urls:', e);
            }
            
            return {
                ...record,
                attachments: attachments
            };
        });

        res.json({ 
            success: true, 
            data: feedbackData 
        });

    } catch (err) {
        console.error('Error obteniendo feedback:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Servir archivos estáticos de uploads
app.use('/uploads', express.static('uploads'));

app.listen(PORT, async () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    await connectDB();
});

process.on('SIGINT', async () => {
    console.log('Cerrando conexión a la base de datos...');
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

// Endpoint temporal para verificar estructura de tabla
app.get('/api/check-table-structure', async (req, res) => {
    try {
        if (!pool || !isConnected) {
            return res.status(500).json({
                success: false,
                message: 'No hay conexión activa a la base de datos'
            });
        }

        // Verificar columnas de la tabla feedback
        const result = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'feedback'
            ORDER BY ORDINAL_POSITION
        `);
        
        res.json({
            success: true,
            columns: result.recordset
        });
        
    } catch (err) {
        console.error('Error al verificar estructura:', err);
        res.status(500).json({
            success: false,
            message: 'Error al verificar estructura de tabla',
            error: err.message
        });
    }
});
