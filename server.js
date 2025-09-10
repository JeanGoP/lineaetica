// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 10000; // Cambiado a 10000 para Render

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuración de SQL Server
const config = {
    server: process.env.DB_SERVER || 'stecno.dyndns.org',
    port: parseInt(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Sintesis2018*',
    database: process.env.DB_DATABASE || 'etica',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 60000,
        connectionTimeout: 60000,
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
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen, PDF y documentos'));
        }
    }
});

// Variables de conexión
let pool;
let isConnected = false;

// Función para conectar a la base de datos
async function connectDB() {
    try {
        if (!isConnected) {
            console.log('Intentando conectar a SQL Server...');
            console.log('Servidor:', config.server);
            console.log('Puerto:', config.port);
            console.log('Base de datos:', config.database);
            console.log('Usuario:', config.user);
            
            pool = await sql.connect(config);
            isConnected = true;
            console.log('✅ Conectado exitosamente a SQL Server');
            
            // Verificar si la tabla existe
            const checkTableQuery = `
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reportes_etica' AND xtype='U')
                BEGIN
                    CREATE TABLE reportes_etica (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        empresa NVARCHAR(255),
                        tipo_reporte NVARCHAR(100),
                        area NVARCHAR(100),
                        descripcion NVARCHAR(MAX),
                        fecha_incidente DATE,
                        ubicacion NVARCHAR(255),
                        personas_involucradas NVARCHAR(MAX),
                        testigos NVARCHAR(MAX),
                        acciones_tomadas NVARCHAR(MAX),
                        evidencia_adicional NVARCHAR(MAX),
                        nombre_reportante NVARCHAR(255),
                        email_reportante NVARCHAR(255),
                        telefono_reportante NVARCHAR(50),
                        es_anonimo BIT DEFAULT 0,
                        archivos_adjuntos NVARCHAR(MAX),
                        fecha_creacion DATETIME DEFAULT GETDATE(),
                        estado NVARCHAR(50) DEFAULT 'Pendiente'
                    )
                END
            `;
            
            await pool.request().query(checkTableQuery);
            console.log('✅ Tabla verificada/creada exitosamente');
        }
        return pool;
    } catch (err) {
        console.error('❌ Error conectando a SQL Server:', err.message);
        console.error('Detalles del error:', err);
        isConnected = false;
        throw err;
    }
}

// Configuración de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Función para enviar notificación por email
async function sendReportNotification(reportData) {
    if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_EMAIL) {
        console.log('⚠️ Variables de entorno para email no configuradas');
        return;
    }

    try {
        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
                .content { background: #f8f9fa; padding: 20px; }
                .field { margin-bottom: 15px; }
                .label { font-weight: bold; color: #2c3e50; }
                .value { margin-top: 5px; padding: 8px; background: white; border-radius: 4px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚨 Nuevo Reporte de Línea Ética</h1>
                </div>
                <div class="content">
                    <div class="field">
                        <div class="label">Empresa:</div>
                        <div class="value">${reportData.empresa || 'No especificada'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Tipo de Reporte:</div>
                        <div class="value">${reportData.tipo_reporte}</div>
                    </div>
                    <div class="field">
                        <div class="label">Fecha del Incidente:</div>
                        <div class="value">${reportData.fecha_incidente || 'No especificada'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Área:</div>
                        <div class="value">${reportData.area}</div>
                    </div>
                    <div class="field">
                        <div class="label">Descripción:</div>
                        <div class="value">${reportData.descripcion}</div>
                    </div>
                    ${reportData.nombre_reportante ? `
                    <div class="field">
                        <div class="label">Reportante:</div>
                        <div class="value">
                            <strong>Nombre:</strong> ${reportData.nombre_reportante}<br>
                            <strong>Email:</strong> ${reportData.email_reportante}<br>
                            ${reportData.telefono_reportante ? `<strong>Teléfono:</strong> ${reportData.telefono_reportante}` : ''}
                        </div>
                    </div>
                    ` : ''}
                    ${reportData.archivos_adjuntos ? `
                    <div class="field">
                        <div class="label">Archivos Adjuntos:</div>
                        <div class="value">${reportData.archivos_adjuntos.split(',').length} archivo(s) adjunto(s)</div>
                    </div>
                    ` : ''}
                    <div class="field">
                        <div class="label">Fecha de Reporte:</div>
                        <div class="value">${new Date().toLocaleString('es-ES')}</div>
                    </div>
                </div>
                <div class="footer">
                    <p>Este es un mensaje automático del sistema de Línea Ética.</p>
                    <p>Por favor, no responda a este correo.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        await resend.emails.send({
            from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
            to: process.env.NOTIFICATION_EMAIL,
            subject: `🚨 Nuevo Reporte de Línea Ética - ${reportData.tipo_reporte}`,
            html: emailHtml
        });

        console.log('✅ Email de notificación enviado exitosamente');
    } catch (error) {
        console.error('❌ Error enviando email de notificación:', error);
    }
}

// Rutas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para enviar reportes
app.post('/api/submit-report', upload.array('attachments', 5), async (req, res) => {
    try {
        console.log('📝 Recibiendo nuevo reporte...');
        console.log('Datos recibidos:', req.body);
        console.log('Archivos recibidos:', req.files?.length || 0);

        // Validar datos requeridos
        const { tipo_reporte, area, descripcion } = req.body;
        if (!tipo_reporte || !area || !descripcion) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: tipo_reporte, area, descripcion'
            });
        }

        // Conectar a la base de datos
        const dbPool = await connectDB();
        
        // Procesar archivos adjuntos
        let archivosAdjuntos = '';
        if (req.files && req.files.length > 0) {
            archivosAdjuntos = req.files.map(file => file.filename).join(',');
            console.log('📎 Archivos procesados:', archivosAdjuntos);
        }

        // Determinar si es anónimo
        const esAnonimo = !req.body.nombre_reportante || req.body.nombre_reportante.trim() === '';
        
        // Manejar fechas (single o range)
        let fechaIncidente = null;
        if (req.body.fecha_incidente) {
            fechaIncidente = req.body.fecha_incidente;
        } else if (req.body.fecha_incidente_inicial && req.body.fecha_incidente_final) {
            fechaIncidente = `${req.body.fecha_incidente_inicial} - ${req.body.fecha_incidente_final}`;
        } else if (req.body.fecha_incidente_inicial) {
            fechaIncidente = req.body.fecha_incidente_inicial;
        }

        // Preparar datos para insertar
        const reportData = {
            empresa: req.body.empresa || null,
            tipo_reporte: req.body.tipo_reporte,
            area: req.body.area,
            descripcion: req.body.descripcion,
            fecha_incidente: fechaIncidente,
            ubicacion: req.body.ubicacion || null,
            personas_involucradas: req.body.personas_involucradas || null,
            testigos: req.body.testigos || null,
            acciones_tomadas: req.body.acciones_tomadas || null,
            evidencia_adicional: req.body.evidencia_adicional || null,
            nombre_reportante: esAnonimo ? null : req.body.nombre_reportante,
            email_reportante: esAnonimo ? null : req.body.email_reportante,
            telefono_reportante: esAnonimo ? null : req.body.telefono_reportante,
            es_anonimo: esAnonimo,
            archivos_adjuntos: archivosAdjuntos || null
        };

        console.log('💾 Insertando en base de datos...');
        
        // Insertar en la base de datos
        const query = `
            INSERT INTO reportes_etica (
                empresa, tipo_reporte, area, descripcion, fecha_incidente, ubicacion,
                personas_involucradas, testigos, acciones_tomadas, evidencia_adicional,
                nombre_reportante, email_reportante, telefono_reportante, es_anonimo, archivos_adjuntos
            ) VALUES (
                @empresa, @tipo_reporte, @area, @descripcion, @fecha_incidente, @ubicacion,
                @personas_involucradas, @testigos, @acciones_tomadas, @evidencia_adicional,
                @nombre_reportante, @email_reportante, @telefono_reportante, @es_anonimo, @archivos_adjuntos
            )
        `;

        const request = dbPool.request();
        
        // Agregar parámetros
        Object.keys(reportData).forEach(key => {
            request.input(key, reportData[key]);
        });

        await request.query(query);
        
        console.log('✅ Reporte guardado exitosamente');

        // Enviar notificación por email
        try {
            await sendReportNotification(reportData);
        } catch (emailError) {
            console.error('⚠️ Error enviando email (continuando):', emailError.message);
            // Continuar aunque falle el email
        }

        res.json({
            success: true,
            message: 'Reporte enviado exitosamente',
            data: {
                tipo_reporte: reportData.tipo_reporte,
                area: reportData.area,
                es_anonimo: reportData.es_anonimo,
                archivos_adjuntos: req.files?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ Error procesando reporte:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Endpoint para obtener reportes (para dashboard)
app.get('/api/reports', async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request().query(`
            SELECT 
                id,
                empresa,
                tipo_reporte,
                area,
                descripcion,
                fecha_incidente,
                ubicacion,
                CASE WHEN es_anonimo = 1 THEN 'Anónimo' ELSE nombre_reportante END as reportante,
                CASE WHEN es_anonimo = 1 THEN NULL ELSE email_reportante END as email_reportante,
                es_anonimo,
                archivos_adjuntos,
                fecha_creacion,
                estado
            FROM reportes_etica 
            ORDER BY fecha_creacion DESC
        `);
        
        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error obteniendo reportes:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo reportes',
            error: error.message
        });
    }
});

// Endpoint para obtener feedback/estadísticas
app.get('/api/feedback', async (req, res) => {
    try {
        const dbPool = await connectDB();
        
        // Obtener estadísticas básicas
        const statsQuery = `
            SELECT 
                COUNT(*) as total_reportes,
                SUM(CASE WHEN es_anonimo = 1 THEN 1 ELSE 0 END) as reportes_anonimos,
                SUM(CASE WHEN es_anonimo = 0 THEN 1 ELSE 0 END) as reportes_identificados,
                COUNT(DISTINCT area) as areas_reportadas,
                COUNT(DISTINCT tipo_reporte) as tipos_reporte
            FROM reportes_etica
        `;
        
        const statsResult = await dbPool.request().query(statsQuery);
        
        // Obtener reportes por área
        const areaQuery = `
            SELECT 
                area,
                COUNT(*) as cantidad
            FROM reportes_etica 
            GROUP BY area
            ORDER BY cantidad DESC
        `;
        
        const areaResult = await dbPool.request().query(areaQuery);
        
        // Obtener reportes por tipo
        const tipoQuery = `
            SELECT 
                tipo_reporte,
                COUNT(*) as cantidad
            FROM reportes_etica 
            GROUP BY tipo_reporte
            ORDER BY cantidad DESC
        `;
        
        const tipoResult = await dbPool.request().query(tipoQuery);
        
        res.json({
            success: true,
            data: {
                estadisticas: statsResult.recordset[0],
                por_area: areaResult.recordset,
                por_tipo: tipoResult.recordset
            }
        });
    } catch (error) {
        console.error('Error obteniendo feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas',
            error: error.message
        });
    }
});

// Endpoint para pruebas de conexión
app.get('/api/test-connection', async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request().query('SELECT 1 as test');
        
        res.json({
            success: true,
            message: 'Conexión exitosa',
            data: result.recordset
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error de conexión',
            error: error.message
        });
    }
});

// Servir archivos estáticos de uploads
app.use('/uploads', express.static('uploads'));

// Iniciar servidor - SOLO UNA VEZ
app.listen(PORT, async () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    await connectDB();
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n🔄 Cerrando servidor...');
    if (pool) {
        await pool.close();
    }
    process.exit(0);
});