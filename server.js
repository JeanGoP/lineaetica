// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 10000; // Cambiado a 10000 para Render

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'etica-line-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Cambiar a true en producción con HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

app.use(express.static('public'));

// Middleware de autenticación
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado. Debe iniciar sesión.'
        });
    }
}

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
            
            // Verificar si las tablas existen
            const checkTablesQuery = `
                -- Crear tabla reportes_etica si no existe
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
                
                -- Crear tabla feedback si no existe
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='feedback' AND xtype='U')
                BEGIN
                    CREATE TABLE feedback (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(255),
                        email NVARCHAR(255),
                        phone NVARCHAR(50),
                        company NVARCHAR(255),
                        position NVARCHAR(255),
                        situation_relation NVARCHAR(255),
                        type NVARCHAR(100),
                        subject NVARCHAR(255),
                        message NVARCHAR(MAX),
                        anonymous BIT DEFAULT 0,
                        attachment_urls NVARCHAR(MAX),
                        area NVARCHAR(100),
                        puntos_venta NVARCHAR(255),
                        incident_date DATE,
                        incident_date_initial DATE,
                        incident_date_end DATE,
                        fecha_creacion DATETIME DEFAULT GETDATE(),
                        estado NVARCHAR(50) DEFAULT 'Pendiente'
                    )
                END
                ELSE
                BEGIN
                    -- Agregar columnas si no existen
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'feedback' AND COLUMN_NAME = 'incident_date_initial')
                    BEGIN
                        ALTER TABLE feedback ADD incident_date_initial DATE
                    END
                    
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'feedback' AND COLUMN_NAME = 'incident_date_end')
                    BEGIN
                        ALTER TABLE feedback ADD incident_date_end DATE
                    END
                    
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'feedback' AND COLUMN_NAME = 'fecha_creacion')
                    BEGIN
                        ALTER TABLE feedback ADD fecha_creacion DATETIME DEFAULT GETDATE()
                    END
                END
                
                -- Crear tabla users si no existe
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
                BEGIN
                    CREATE TABLE users (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        email NVARCHAR(255) UNIQUE NOT NULL,
                        password_hash NVARCHAR(255) NOT NULL,
                        nombre NVARCHAR(255),
                        rol NVARCHAR(50) DEFAULT 'admin',
                        activo BIT DEFAULT 1,
                        fecha_creacion DATETIME DEFAULT GETDATE(),
                        ultimo_acceso DATETIME
                    )
                END
            `;
            
            await pool.request().query(checkTablesQuery);
            console.log('✅ Tablas verificadas/creadas exitosamente');
            
            // Crear usuario administrador por defecto si no existe
            await createDefaultAdmin();
        }
        return pool;
    } catch (err) {
        console.error('❌ Error conectando a SQL Server:', err.message);
        console.error('Detalles del error:', err);
        isConnected = false;
        throw err;
    }
}

// Función para crear usuario administrador por defecto
async function createDefaultAdmin() {
    try {
        const defaultEmail = 'mrocha@motosyservicios.com';
        const defaultPassword = 'NxJkLxhfGCpcg5v';
        
        // Verificar si ya existe el usuario
        const checkUserQuery = 'SELECT id FROM users WHERE email = @email';
        const checkResult = await pool.request()
            .input('email', sql.NVarChar, defaultEmail)
            .query(checkUserQuery);
        
        if (checkResult.recordset.length === 0) {
            // Hash de la contraseña
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
            
            // Crear usuario administrador
            const insertUserQuery = `
                INSERT INTO users (email, password_hash, nombre, rol, activo)
                VALUES (@email, @passwordHash, @nombre, @rol, @activo)
            `;
            
            await pool.request()
                .input('email', sql.NVarChar, defaultEmail)
                .input('passwordHash', sql.NVarChar, passwordHash)
                .input('nombre', sql.NVarChar, 'Administrador')
                .input('rol', sql.NVarChar, 'admin')
                .input('activo', sql.Bit, true)
                .query(insertUserQuery);
            
            console.log('✅ Usuario administrador creado exitosamente');
        } else {
            console.log('ℹ️ Usuario administrador ya existe');
        }
    } catch (err) {
        console.error('❌ Error creando usuario administrador:', err.message);
    }
}

// Configuración de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Función para enviar notificación por email
async function sendReportNotification(reportData, attachmentFiles = []) {
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
                    ${reportData.puntos_venta ? `
                    <div class="field">
                        <div class="label">Punto de Venta:</div>
                        <div class="value">${reportData.puntos_venta}</div>
                    </div>
                    ` : ''}
                    <div class="field">
                        <div class="label">Relación con la Empresa:</div>
                        <div class="value">${reportData.position || 'No especificada'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Relación con la Situación:</div>
                        <div class="value">${reportData.situation_relation || 'No especificada'}</div>
                    </div>
                    <div class="field">
                        <div class="label">Tipo de Reporte:</div>
                        <div class="value">${reportData.tipo_reporte}</div>
                    </div>
                    <div class="field">
                        <div class="label">Fecha del Incidente:</div>
                        <div class="value">${reportData.fecha_incidente || (reportData.fecha_incidente_inicial && reportData.fecha_incidente_final ? `${reportData.fecha_incidente_inicial} - ${reportData.fecha_incidente_final}` : 'No especificada')}</div>
                    </div>
                    <div class="field">
                        <div class="label">Área:</div>
                        <div class="value">${reportData.area}</div>
                    </div>
                    <div class="field">
                        <div class="label">Asunto:</div>
                        <div class="value">${reportData.asunto}</div>
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

        // Preparar archivos adjuntos para el email
         const emailAttachments = [];
         if (attachmentFiles && attachmentFiles.length > 0) {
             for (const file of attachmentFiles) {
                try {
                    const filePath = path.join(__dirname, 'uploads', file.filename);
                    const fileContent = fs.readFileSync(filePath);
                    emailAttachments.push({
                        filename: file.originalname,
                        content: fileContent
                    });
                } catch (fileError) {
                    console.error('⚠️ Error leyendo archivo adjunto:', file.filename, fileError.message);
                }
            }
        }

        const emailOptions = {
            from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
            to: process.env.NOTIFICATION_EMAIL,
            subject: `🚨 Nuevo Reporte de Línea Ética - ${reportData.tipo_reporte}`,
            html: emailHtml
        };

        // Agregar archivos adjuntos si existen
        if (emailAttachments.length > 0) {
            emailOptions.attachments = emailAttachments;
        }

        await resend.emails.send(emailOptions);

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

        // Preparar datos para insertar en tabla feedback
        const reportData = {
            name: esAnonimo ? null : req.body.nombre_reportante,
            email: esAnonimo ? null : req.body.email_reportante,
            phone: esAnonimo ? null : req.body.telefono_reportante,
            company: req.body.empresa || 'No especificada',
            position: req.body.position || 'No especificado',
            situation_relation: req.body.situation_relation || 'No especificado',
            type: req.body.tipo_reporte,
            subject: req.body.asunto || req.body.tipo_reporte,
            message: req.body.descripcion,
            anonymous: esAnonimo,
            attachment_urls: archivosAdjuntos || null,
            area: req.body.area,
            puntos_venta: req.body.puntos_venta || null,
            incident_date: req.body.fecha_incidente || null,
            incident_date_initial: req.body.fecha_incidente_inicial || null,
            incident_date_end: req.body.fecha_incidente_final || null
        };

        console.log('💾 Insertando en base de datos...');
        
        // Insertar en la tabla feedback
        const query = `
            INSERT INTO feedback (
                name, email, phone, company, position, situation_relation, type, subject, 
                message, anonymous, attachment_urls, area, puntos_venta, 
                incident_date, incident_date_initial, incident_date_end
            ) VALUES (
                @name, @email, @phone, @company, @position, @situation_relation, @type, @subject,
                @message, @anonymous, @attachment_urls, @area, @puntos_venta,
                @incident_date, @incident_date_initial, @incident_date_end
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
            // Mapear datos para el email con los nombres correctos
            const emailData = {
                empresa: reportData.company,
                puntos_venta: reportData.puntos_venta,
                position: reportData.position,
                situation_relation: reportData.situation_relation,
                tipo_reporte: reportData.type,
                area: reportData.area,
                asunto: reportData.subject,
                descripcion: reportData.message,
                fecha_incidente: reportData.incident_date,
                fecha_incidente_inicial: reportData.incident_date_initial,
                fecha_incidente_final: reportData.incident_date_end,
                nombre_reportante: reportData.name,
                email_reportante: reportData.email,
                telefono_reportante: reportData.phone,
                archivos_adjuntos: archivosAdjuntos,
                es_anonimo: reportData.anonymous
            };
            
            await sendReportNotification(emailData, req.files);
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Endpoint para obtener reportes (para dashboard)
app.get('/api/reports', requireAuth, async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request().query(`
            SELECT 
                id,
                company as empresa,
                type as tipo_reporte,
                area,
                subject as asunto,
                message as descripcion,
                incident_date as fecha_incidente,
                incident_date_initial as fecha_incidente_inicial,
                incident_date_end as fecha_incidente_final,
                CASE WHEN anonymous = 1 THEN 'Anónimo' ELSE name END as reportante,
                CASE WHEN anonymous = 1 THEN NULL ELSE email END as email_reportante,
                anonymous as es_anonimo,
                attachment_urls as archivos_adjuntos,
                fecha_creacion,
                puntos_venta,
                position,
                situation_relation
            FROM feedback 
            ORDER BY fecha_creacion DESC
        `);
        
        res.json({
            success: true,
            reports: result.recordset
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

// Endpoint de autenticación
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validar que se proporcionen email y password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos'
            });
        }
        
        const dbPool = await connectDB();
        
        // Buscar usuario por email
        const userQuery = `
            SELECT id, email, password_hash, nombre, rol, activo
            FROM users 
            WHERE email = @email AND activo = 1
        `;
        
        const userResult = await dbPool.request()
            .input('email', sql.NVarChar, email)
            .query(userQuery);
        
        if (userResult.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }
        
        const user = userResult.recordset[0];
        
        // Verificar contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }
        
        // Actualizar último acceso
        const updateAccessQuery = `
            UPDATE users 
            SET ultimo_acceso = GETDATE() 
            WHERE id = @userId
        `;
        
        await dbPool.request()
            .input('userId', sql.Int, user.id)
            .query(updateAccessQuery);
        
        // Crear sesión de usuario
        req.session.user = {
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            rol: user.rol
        };
        
        // Respuesta exitosa (sin incluir password_hash)
        res.json({
            success: true,
            message: 'Autenticación exitosa',
            user: {
                id: user.id,
                email: user.email,
                nombre: user.nombre,
                rol: user.rol
            }
        });
        
    } catch (error) {
        console.error('Error en autenticación:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Endpoint para verificar sesión
app.get('/api/auth/verify', (req, res) => {
    if (req.session && req.session.user) {
        res.json({
            success: true,
            authenticated: true,
            user: req.session.user
        });
    } else {
        res.json({
            success: true,
            authenticated: false
        });
    }
});

// Endpoint para logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error al cerrar sesión'
            });
        }
        
        res.clearCookie('connect.sid'); // Nombre por defecto de la cookie de sesión
        res.json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });
    });
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