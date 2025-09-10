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
        console.log('=== INICIANDO CONEXIÓN A SQL SERVER ===');
        console.log('🔧 Configuración de conexión:');
        console.log('  - Servidor:', config.server);
        console.log('  - Puerto:', config.port);
        console.log('  - Base de datos:', config.database);
        console.log('  - Usuario:', config.user);
        console.log('  - Entorno:', process.env.NODE_ENV || 'development');
        console.log('  - Variables de entorno disponibles:');
        console.log('    * DB_SERVER:', process.env.DB_SERVER ? '✅ Configurada' : '❌ No configurada');
        console.log('    * DB_PORT:', process.env.DB_PORT ? '✅ Configurada' : '❌ No configurada');
        console.log('    * DB_USER:', process.env.DB_USER ? '✅ Configurada' : '❌ No configurada');
        console.log('    * DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ Configurada' : '❌ No configurada');
        console.log('    * DB_DATABASE:', process.env.DB_DATABASE ? '✅ Configurada' : '❌ No configurada');
        
        console.log('🔄 Intentando establecer conexión...');
        pool = await sql.connect(config);
        isConnected = true;
        console.log('✅ Conectado exitosamente a SQL Server');
        
        // Manejar eventos de conexión
        pool.on('error', err => {
            console.error('❌ Error en la conexión de SQL Server:', err);
            isConnected = false;
        });
        
        // Probar la conexión con una consulta simple
        console.log('🧪 Ejecutando prueba de consulta...');
        const testResult = await pool.request().query('SELECT 1 as test, GETDATE() as fecha_actual, DB_NAME() as nombre_bd');
        console.log('✅ Prueba de consulta exitosa:', testResult.recordset[0]);
        
    } catch (err) {
        console.error('❌ ERROR CONECTANDO A LA BASE DE DATOS:');
        console.error('  - Código de error:', err.code);
        console.error('  - Mensaje:', err.message);
        console.error('  - Número de error:', err.number);
        console.error('  - Estado:', err.state);
        console.error('  - Clase:', err.class);
        console.error('  - Servidor:', err.server);
        console.error('  - Procedimiento:', err.procName);
        console.error('  - Línea:', err.lineNumber);
        console.error('  - Detalles completos:', JSON.stringify(err, null, 2));
        
        isConnected = false;
        
        // Reintentar conexión después de 15 segundos
        console.log('🔄 Reintentando conexión en 15 segundos...');
        setTimeout(connectDB, 15000);
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
    console.log('📊 [REPORTS] Solicitud recibida para /api/reports');
    console.log('🔍 [REPORTS] Estado de conexión actual:', isConnected);
    console.log('🔍 [REPORTS] Pool existe:', !!pool);
    
    try {
        // Verificar si hay conexión activa
        if (!pool || !isConnected) {
            console.log('⚠️ [REPORTS] No hay conexión activa, intentando reconectar...');
            await connectDB();
            console.log('🔄 [REPORTS] Reconexión completada, estado:', isConnected);
            
            // Verificar si la reconexión fue exitosa
            if (!isConnected) {
                console.error('❌ [REPORTS] No se pudo establecer conexión después del reintento');
                return res.status(500).json({
                    success: false,
                    message: 'No se puede conectar a la base de datos. Servicio temporalmente no disponible.',
                    error_code: 'DB_CONNECTION_FAILED'
                });
            }
        }

        console.log('🔄 [REPORTS] Iniciando consulta de reportes...');
        console.log('🔄 [REPORTS] Pool conectado:', pool.connected);
        
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
        
        console.log('✅ [REPORTS] Consulta ejecutada exitosamente');
        console.log('📊 [REPORTS] Número de registros obtenidos:', result.recordset.length);

        // Procesar los datos para el formato esperado
        const processedData = result.recordset.map((record, index) => {
            console.log(`🔄 [REPORTS] Procesando reporte ${index + 1}/${result.recordset.length}`);
            let attachmentUrls = [];
            try {
                if (record.attachment_urls) {
                    attachmentUrls = JSON.parse(record.attachment_urls);
                }
            } catch (e) {
                console.error(`❌ [REPORTS] Error parsing attachment_urls del reporte ${record.id}:`, e);
            }

            return {
                ...record,
                attachment_urls: attachmentUrls,
                fecha: record.fecha ? record.fecha.toISOString().split('T')[0] : null,
                fecha_incidente: record.fecha_incidente ? record.fecha_incidente.toISOString().split('T')[0] : null
            };
        });

        console.log('📋 [REPORTS] Procesamiento completado. Enviando', processedData.length, 'reportes al cliente');
        res.json({
            success: true,
            reports: processedData
        });

    } catch (error) {
        console.error('❌ [REPORTS] ERROR CRÍTICO en /api/reports:');
        console.error('  - Mensaje:', error.message);
        console.error('  - Código:', error.code);
        console.error('  - Número:', error.number);
        console.error('  - Clase:', error.class);
        console.error('  - Estado:', error.state);
        console.error('  - Línea:', error.lineNumber);
        console.error('  - Procedimiento:', error.procName);
        console.error('  - Servidor:', error.serverName);
        console.error('  - Estado de conexión:', isConnected);
        console.error('  - Pool disponible:', !!pool);
        console.error('  - Stack completo:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Error obteniendo reportes de la base de datos',
            error: error.message,
            details: {
                code: error.code,
                number: error.number,
                state: error.state,
                class: error.class
            },
            connection_status: isConnected,
            timestamp: new Date().toISOString()
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
        const result = await pool.request().query('SELECT GETDATE() as fecha_actual, DB_NAME() as nombre_bd');
        
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

// Endpoint de diagnóstico específico
app.get('/api/debug-connection', async (req, res) => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        steps: [],
        success: false,
        error: null
    };
    
    try {
        // Paso 1: Verificar variables de entorno
        diagnostics.steps.push({
            step: 1,
            name: 'Variables de entorno',
            status: 'checking',
            details: {
                DB_SERVER: !!process.env.DB_SERVER,
                DB_PORT: !!process.env.DB_PORT,
                DB_USER: !!process.env.DB_USER,
                DB_PASSWORD: !!process.env.DB_PASSWORD,
                DB_DATABASE: !!process.env.DB_DATABASE
            }
        });
        
        // Paso 2: Verificar estado del pool
        diagnostics.steps.push({
            step: 2,
            name: 'Estado del pool',
            status: 'checking',
            details: {
                poolExists: !!pool,
                isConnected: isConnected,
                poolConnected: pool ? pool.connected : false
            }
        });
        
        // Paso 3: Intentar conexión si es necesario
        if (!pool || !isConnected) {
            diagnostics.steps.push({
                step: 3,
                name: 'Intentando conexión',
                status: 'running'
            });
            
            await connectDB();
            
            diagnostics.steps[2].status = isConnected ? 'success' : 'failed';
            diagnostics.steps[2].details = {
                connectionEstablished: isConnected,
                poolConnected: pool ? pool.connected : false
            };
        }
        
        // Paso 4: Probar consulta simple
        diagnostics.steps.push({
            step: 4,
            name: 'Consulta de prueba',
            status: 'running'
        });
        
        const testResult = await pool.request().query('SELECT 1 as test, GETDATE() as fecha_actual, DB_NAME() as nombre_bd');
        
        diagnostics.steps[diagnostics.steps.length - 1].status = 'success';
        diagnostics.steps[diagnostics.steps.length - 1].details = testResult.recordset[0];
        
        // Paso 5: Verificar tabla reportes
        diagnostics.steps.push({
            step: 5,
            name: 'Verificar tabla reportes',
            status: 'running'
        });
        
        const tableCheck = await pool.request().query("SELECT COUNT(*) as count FROM reportes");
        
        diagnostics.steps[diagnostics.steps.length - 1].status = 'success';
        diagnostics.steps[diagnostics.steps.length - 1].details = {
            tableExists: true,
            recordCount: tableCheck.recordset[0].count
        };
        
        // Paso 6: Probar consulta completa de reportes
        diagnostics.steps.push({
            step: 6,
            name: 'Consulta completa de reportes',
            status: 'running'
        });
        
        const reportsResult = await pool.request().query(`
            SELECT TOP 1
                id,
                nombre_completo,
                email,
                telefono,
                tipo_reporte,
                descripcion,
                fecha_creacion,
                adjuntos
            FROM reportes 
            ORDER BY fecha_creacion DESC
        `);
        
        diagnostics.steps[diagnostics.steps.length - 1].status = 'success';
        diagnostics.steps[diagnostics.steps.length - 1].details = {
            queryExecuted: true,
            sampleRecord: reportsResult.recordset[0] || null,
            recordsFound: reportsResult.recordset.length
        };
        
        diagnostics.success = true;
        
    } catch (error) {
        diagnostics.error = {
            message: error.message,
            code: error.code,
            number: error.number,
            state: error.state,
            class: error.class,
            lineNumber: error.lineNumber,
            procName: error.procName,
            serverName: error.serverName
        };
        
        // Marcar el último paso como fallido
        if (diagnostics.steps.length > 0) {
            diagnostics.steps[diagnostics.steps.length - 1].status = 'failed';
            diagnostics.steps[diagnostics.steps.length - 1].error = diagnostics.error;
        }
    }
    
    res.json(diagnostics);
});

// Endpoint temporal para verificar estructura de tabla
app.get('/api/check-table-structure', async (req, res) => {
    try {
        if (!pool || !isConnected) {
            await connectDB();
        }
        
        const result = await pool.request().query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'reportes'
            ORDER BY ORDINAL_POSITION
        `);
        
        res.json({
            success: true,
            columns: result.recordset
        });
        
    } catch (error) {
        console.error('Error checking table structure:', error);
        res.status(500).json({
            success: false,
            message: 'Error verificando estructura de tabla',
            error: error.message
        });
    }
});
