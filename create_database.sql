-- Script para crear la base de datos del sistema de línea ética
-- SQL Server

-- 1. Crear la base de datos (ejecutar como administrador)
CREATE DATABASE etica;
GO

-- 2. Usar la base de datos
USE etica;
GO

-- 3. Crear tabla para reportes de ética
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
    );
    PRINT '✅ Tabla reportes_etica creada exitosamente';
END
ELSE
BEGIN
    PRINT '⚠️ La tabla reportes_etica ya existe';
END
GO

-- 4. Crear tabla para usuarios del sistema
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
    );
    PRINT '✅ Tabla users creada exitosamente';
END
ELSE
BEGIN
    PRINT '⚠️ La tabla users ya existe';
END
GO

-- 5. Crear usuario administrador por defecto
-- Nota: La contraseña 'admin123' se hashea con bcrypt en la aplicación
-- Este script es solo para referencia, el usuario se crea automáticamente desde la aplicación
IF NOT EXISTS (SELECT * FROM users WHERE email = 'admin@etica.com')
BEGIN
    PRINT '⚠️ El usuario administrador se creará automáticamente cuando inicie la aplicación';
    PRINT 'Credenciales por defecto:';
    PRINT 'Email: admin@etica.com';
    PRINT 'Contraseña: admin123';
END
ELSE
BEGIN
    PRINT '✅ El usuario administrador ya existe';
END
GO

-- 6. Verificar que las tablas se crearon correctamente
SELECT 
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME IN ('reportes_etica', 'users')
ORDER BY TABLE_NAME;

PRINT '🎉 Script de creación de base de datos completado';
PRINT 'Recuerda configurar las credenciales de conexión en el archivo .env';
GO