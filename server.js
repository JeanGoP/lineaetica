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
        console.log('✅ Conectado exitosamente a SQL Server');
        
        // Manejar eventos de conexión
        pool.on('error', err => {
            console.error('❌ Error en la conexión de SQL Server:', err);
            isConnected = false;
        });
        
        // Probar la conexión con una consulta simple
        const testResult = await pool.request().query('SELECT 1 as test');
        console.log('✅ Prueba de consulta exitosa:', testResult.recordset);
        
    } catch (err) {
        console.error('❌ Error conectando a la base de datos:');
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
        // ❌ ELIMINAR estas líneas de aquí:
        // console.log('incident_date:', incident_date);
        // console.log('incident_date_initial:', incident_date_initial);
        // console.log('incident_date_end:', incident_date_end);
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

        // ✅ MOVER estas líneas aquí:
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
            console.log('❌ RECHAZANDO: situation_relation es inválido');
            return res.status(400).json({
                success: false,
                message: 'El campo "¿Qué relación tiene con la situación expuesta?" es requerido y no puede estar vacío'
            });
        }
        
        const cleanSituationRelation = situation_relation.toString().trim();
        console.log('✅ situation_relation limpio:', cleanSituationRelation);

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

        console.log('✅ Reporte guardado exitosamente con ID:', reportId);

        res.json({ 
            success: true, 
            message: 'Reporte enviado exitosamente',
            reportId: reportId
        });

    } catch (err) {
        console.error('❌ ERROR COMPLETO AL ENVIAR REPORTE:');
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


// Reemplaza el endpoint actual con esta versión mejorada
app.post('/api/submit-report', upload.array('attachments', 5), async (req, res) => {
    try {
        console.log('=== INICIO DE PROCESAMIENTO ===');
        console.log('Datos recibidos:', JSON.stringify(req.body, null, 2));
        
        // Verificar conexión a la base de datos
        if (!pool || !isConnected) {
            console.log('❌ ERROR: Sin conexión a la base de datos');
            return res.status(500).json({ 
                success: false, 
                message: 'Error de conexión a la base de datos. Verifique la conexión.' 
            });
        }
        
        console.log('✅ Conexión a BD verificada');
        
        // Extraer datos del formulario
        const {
            name, email, phone, company, position, situation_relation,
            area, type, subject, message, anonymous, puntos_venta,
            incident_date, incident_date_initial, incident_date_end
        } = req.body;
        
        console.log('=== VALIDACIÓN DE CAMPOS REQUERIDOS ===');
        console.log('situation_relation:', situation_relation);
        console.log('area:', area);
        console.log('type:', type);
        console.log('subject:', subject);
        console.log('message:', message);
        
        // Validaciones básicas
        if (!situation_relation || situation_relation.trim() === '') {
            console.log('❌ ERROR: situation_relation vacío');
            return res.status(400).json({
                success: false,
                message: 'El campo "¿Qué relación tiene con la situación expuesta?" es requerido'
            });
        }
        
        if (!area || area.trim() === '') {
            console.log('❌ ERROR: area vacío');
            return res.status(400).json({
                success: false,
                message: 'El campo "Área" es requerido'
            });
        }
        
        if (!type || type.trim() === '') {
            console.log('❌ ERROR: type vacío');
            return res.status(400).json({
                success: false,
                message: 'El campo "Tipo de Reporte" es requerido'
            });
        }
        
        if (!subject || subject.trim() === '') {
            console.log('❌ ERROR: subject vacío');
            return res.status(400).json({
                success: false,
                message: 'El campo "Asunto" es requerido'
            });
        }
        
        if (!message || message.trim() === '') {
            console.log('❌ ERROR: message vacío');
            return res.status(400).json({
                success: false,
                message: 'El campo "Mensaje" es requerido'
            });
        }
        
        console.log('✅ Todas las validaciones pasaron');
        
        // Procesar archivos adjuntos
        let attachmentUrls = [];
        if (req.files && req.files.length > 0) {
            attachmentUrls = req.files.map(file => `/uploads/${file.filename}`);
            console.log('📎 Archivos adjuntos:', attachmentUrls);
        }
        
        // Preparar inserción en la base de datos
        const request = pool.request();
        const reportId = uuidv4();
        
        console.log('=== PREPARANDO INSERCIÓN ===');
        console.log('Report ID:', reportId);
        
        // Inserción con manejo de errores mejorado
        await request
            .input('id', sql.UniqueIdentifier, reportId)
            .input('name', sql.NVarChar, (anonymous === 'true' || anonymous === true) ? null : (name || null))
            .input('email', sql.NVarChar, (anonymous === 'true' || anonymous === true) ? null : (email || null))
            .input('phone', sql.NVarChar, (anonymous === 'true' || anonymous === true) ? null : (phone || null))
            .input('company', sql.NVarChar, company || null)
            .input('position', sql.NVarChar, position || null)
            .input('situation_relation', sql.NVarChar, situation_relation.trim())
            .input('area', sql.NVarChar, area.trim())
            .input('type', sql.NVarChar, type.trim())
            .input('subject', sql.NVarChar, subject.trim())
            .input('message', sql.NVarChar, message.trim())
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
        
        console.log('✅ Reporte guardado exitosamente con ID:', reportId);
        
        res.json({ 
            success: true, 
            message: 'Reporte enviado exitosamente',
            reportId: reportId
        });
        
    } catch (err) {
        console.error('❌ ERROR DETALLADO AL ENVIAR REPORTE:');
        console.error('Tipo de error:', err.constructor.name);
        console.error('Mensaje:', err.message);
        console.error('Código:', err.code);
        console.error('Número SQL:', err.number);
        console.error('Estado SQL:', err.state);
        console.error('Clase SQL:', err.class);
        console.error('Servidor:', err.serverName);
        console.error('Procedimiento:', err.procName);
        console.error('Línea:', err.lineNumber);
        console.error('Stack completo:', err.stack);
        
        // Manejo específico de errores comunes
        if (err.code === 'ENOTOPEN' || err.code === 'ECONNCLOSED') {
            console.log('🔄 Intentando reconectar...');
            isConnected = false;
            connectDB();
            return res.status(500).json({
                success: false,
                message: 'Error de conexión a la base de datos. Reintentando conexión...'
            });
        }
        
        if (err.number === 515) {
            return res.status(400).json({
                success: false,
                message: `Campo requerido faltante: ${err.message}`
            });
        }
        
        if (err.number === 2) {
            return res.status(500).json({
                success: false,
                message: 'Error: No se puede conectar al servidor de base de datos. Verifique la conexión de red.'
            });
        }
        
        if (err.number === 18456) {
            return res.status(500).json({
                success: false,
                message: 'Error de autenticación en la base de datos. Verifique las credenciales.'
            });
        }
        
        // Error genérico con más información
        res.status(500).json({ 
            success: false,
            message: `Error del servidor: ${err.message}. Código: ${err.code || 'N/A'}`
        });
    }
});
