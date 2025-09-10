//  Variables para datos y estado
let allReports = [];
let filteredReports = [];
let currentUser = null;

// Inicializacion cuando el DOM este listo
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Funcion principal de inicializacion
function initializeDashboard() {
    // Verificar autenticacion
    checkAuthentication();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Cargar datos iniciales
    loadReportsData();
}

// Verificar si el usuario esta autenticado
function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
        // Para propositos de demostracion, crear un token temporal
        localStorage.setItem('authToken', 'demo-token');
        localStorage.setItem('userData', JSON.stringify({name: 'Usuario Demo', role: 'admin'}));
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
        console.log('Usuario autenticado:', currentUser);
    } catch (error) {
        console.error('Error al parsear datos del usuario:', error);
        logout();
    }
}

// Configurar todos los event listeners
function setupEventListeners() {
    // Boton de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Filtros de reportes
    const filterTipo = document.getElementById('filterTipo');
    const filterEmpresa = document.getElementById('filterEmpresa');
    const filterArea = document.getElementById('filterArea');
    const filterPuntoVenta = document.getElementById('filterPuntoVenta');
    const filterPeriodo = document.getElementById('filterPeriodo');
    const searchInput = document.getElementById('searchInput');
    
    if (filterTipo) filterTipo.addEventListener('change', applyFilters);
    if (filterEmpresa) {
        filterEmpresa.addEventListener('change', function() {
            updatePuntoVentaOptions();
            applyFilters();
        });
    }
    if (filterArea) filterArea.addEventListener('change', applyFilters);
    if (filterPuntoVenta) filterPuntoVenta.addEventListener('change', applyFilters);
    if (filterPeriodo) filterPeriodo.addEventListener('change', applyFilters);
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
    
    // Boton de exportar
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
    }
}

// Funcion para actualizar las opciones de punto de venta segun la empresa seleccionada
function updatePuntoVentaOptions() {
    const empresaSelect = document.getElementById('filterEmpresa');
    const puntoVentaSelect = document.getElementById('filterPuntoVenta');
    const puntoVentaGroup = document.getElementById('puntoVentaGroup');
    
    if (!empresaSelect || !puntoVentaSelect || !puntoVentaGroup) return;
    
    const selectedEmpresa = empresaSelect.value;
    
    if (selectedEmpresa) {
        // Mostrar el filtro de punto de venta
        puntoVentaGroup.style.display = 'block';
        puntoVentaSelect.disabled = false;
        
        // Filtrar opciones por empresa
        const options = puntoVentaSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === '') {
                option.style.display = 'block'; // Mostrar "Todos los puntos"
            } else {
                const empresaOption = option.getAttribute('data-empresa');
                option.style.display = empresaOption === selectedEmpresa ? 'block' : 'none';
            }
        });
        
        // Resetear seleccion
        puntoVentaSelect.value = '';
    } else {
        // Ocultar el filtro de punto de venta
        puntoVentaGroup.style.display = 'none';
        puntoVentaSelect.disabled = true;
        puntoVentaSelect.value = '';
    }
}

// Cargar datos de reportes desde el servidor
async function loadReportsData() {
    try {
        showLoading(true);
        
        const response = await fetch('http://localhost:3000/api/reports', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error(`Error del servidor: ${response.status}`);
        }
        
        const data = await response.json();
        const rawReports = data.reports || [];
        
        // Mapear los datos del servidor al formato esperado por el dashboard
        allReports = rawReports.map(report => ({
            id: report.id,
            fechaReporte: report.fecha,
            fechaIncidente: report.fecha_incidente,
            fechaInicialIncidente: report.fecha_incidente_inicial,
            fechaFinalIncidente: report.fecha_incidente_final,
            nombre: report.name,
            email: report.email,
            telefono: report.phone,
            empresa: report.company,
            cargo: report.position,
            relacion: report.situation_relation,
            area: report.area,
            puntoVenta: report.punto_venta,
            tipo: report.tipo,
            asunto: report.asunto,
            mensaje: report.mensaje,
            anonimo: report.anonymous === 'true' || report.anonymous === true,
            archivos: report.attachment_urls || [],
            estado: report.estado || 'pendiente',
            fechaCreacion: report.created_at
        }));
        
        console.log(`Cargados ${allReports.length} reportes desde la base de datos`);
        
        // Aplicar filtros iniciales
        applyFilters();
        
    } catch (error) {
        console.error('Error al cargar reportes:', error);
        showError('Error al cargar los reportes. Por favor, intenta de nuevo.');
        
        // Usar datos de ejemplo si hay error
        loadSampleData();
    } finally {
        showLoading(false);
    }
}

// Cargar datos de ejemplo para desarrollo/testing
function loadSampleData() {
    allReports = [
        {
            id: 1,
            fechaReporte: '2024-01-15',
            fechaIncidente: '2024-01-10',
            fechaInicialIncidente: '2024-01-08',
            fechaFinalIncidente: '2024-01-10',
            nombre: 'Juan Perez',
            email: 'juan.perez@email.com',
            telefono: '3001234567',
            empresa: 'Centromotos',
            cargo: 'Vendedor',
            relacion: 'Empleado',
            area: 'Comercial: Venta y Posventa',
            puntoVenta: 'Calle 170',
            tipo: 'acoso',
            asunto: 'Acoso laboral por parte del supervisor',
            mensaje: 'Descripcion detallada del incidente de acoso laboral...',
            anonimo: false,
            archivos: ['documento1.pdf', 'evidencia1.jpg'],
            estado: 'pendiente',
            fechaCreacion: '2024-01-15T10:30:00Z'
        },
        {
            id: 2,
            fechaReporte: '2024-01-14',
            fechaIncidente: '2024-01-12',
            fechaInicialIncidente: '2024-01-12',
            fechaFinalIncidente: '2024-01-12',
            nombre: 'Maria Rodriguez',
            email: 'maria.rodriguez@email.com',
            telefono: '3009876543',
            empresa: 'Distrimotos',
            cargo: 'Contadora',
            relacion: 'Empleado',
            area: 'contabilidad',
            puntoVenta: 'Valledupar',
            tipo: 'fraude',
            asunto: 'Irregularidades en manejo de caja',
            mensaje: 'Se detectaron inconsistencias en los registros contables...',
            anonimo: true,
            archivos: [],
            estado: 'en_revision',
            fechaCreacion: '2024-01-14T14:20:00Z'
        },
        {
            id: 3,
            fechaReporte: '2024-01-13',
            fechaIncidente: '2024-01-11',
            fechaInicialIncidente: '2024-01-10',
            fechaFinalIncidente: '2024-01-11',
            nombre: 'Carlos Martinez',
            email: 'carlos.martinez@email.com',
            telefono: '3005555555',
            empresa: 'Credimotos',
            cargo: 'Gerente',
            relacion: 'Empleado',
            area: 'administracion',
            puntoVenta: 'Bogota',
            tipo: 'discriminacion',
            asunto: 'Discriminacion por edad en proceso de seleccion',
            mensaje: 'Durante el proceso de seleccion se evidencio discriminacion...',
            anonimo: false,
            archivos: ['correos.pdf'],
            estado: 'resuelto',
            fechaCreacion: '2024-01-13T09:15:00Z'
        }
    ];
    
    console.log('Datos de ejemplo cargados');
    applyFilters();
}

// Aplicar filtros a los reportes
function applyFilters() {
    const filterTipo = document.getElementById('filterTipo')?.value || '';
    const filterEmpresa = document.getElementById('filterEmpresa')?.value || '';
    const filterArea = document.getElementById('filterArea')?.value || '';
    const filterPuntoVenta = document.getElementById('filterPuntoVenta')?.value || '';
    const filterPeriodo = document.getElementById('filterPeriodo')?.value || '';
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    filteredReports = allReports.filter(report => {
        // Filtro por tipo
        if (filterTipo && report.tipo !== filterTipo) return false;
        
        // Filtro por empresa
        if (filterEmpresa && report.empresa !== filterEmpresa) return false;
        
        // Filtro por area
        if (filterArea && report.area !== filterArea) return false;
        
        // Filtro por punto de venta
        if (filterPuntoVenta && report.puntoVenta !== filterPuntoVenta) return false;
        
        // Filtro por periodo
        if (filterPeriodo) {
            const reportDate = new Date(report.fechaReporte);
            const now = new Date();
            
            switch (filterPeriodo) {
                case 'ultimo_mes':
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    if (reportDate < lastMonth) return false;
                    break;
                case 'ultimos_3_meses':
                    const last3Months = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                    if (reportDate < last3Months) return false;
                    break;
                case 'ultimo_ano':
                    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                    if (reportDate < lastYear) return false;
                    break;
            }
        }
        
        // Filtro por busqueda en asunto y mensaje
        if (searchTerm) {
            const asunto = (report.asunto || '').toLowerCase();
            const mensaje = (report.mensaje || '').toLowerCase();
            if (!asunto.includes(searchTerm) && !mensaje.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Actualizar la tabla y metricas
    updateReportsTable();
    updateMetrics();
}

// Actualizar la tabla de reportes
function updateReportsTable() {
    const tableBody = document.getElementById('reportsTableBody');
    const reportCount = document.getElementById('reportCount');
    
    if (!tableBody) return;
    
    // Actualizar contador
    if (reportCount) {
        reportCount.textContent = filteredReports.length;
    }
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    if (filteredReports.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="19" class="no-data">
                    No se encontraron reportes con los filtros aplicados
                </td>
            </tr>
        `;
        return;
    }
    
    // Agregar filas de reportes
    filteredReports.forEach(report => {
        const row = createReportRow(report);
        tableBody.appendChild(row);
    });
}

// Crear una fila de reporte para la tabla
function createReportRow(report) {
    const row = document.createElement('tr');
    
    // Formatear fechas
    const fechaReporte = formatDate(report.fechaReporte);
    const fechaIncidente = formatDate(report.fechaIncidente);
    const fechaInicialIncidente = formatDate(report.fechaInicialIncidente);
    const fechaFinalIncidente = formatDate(report.fechaFinalIncidente);
    
    // Formatear tipo
    const tipoFormatted = formatTipo(report.tipo);
    
    // Formatear estado
    const estadoFormatted = formatEstado(report.estado);
    
    // Archivos
    const archivosCount = report.archivos ? report.archivos.length : 0;
    const archivosBtn = archivosCount > 0 ? 
        `<button class="view-attachments-btn" onclick="viewAttachments(${report.id})">
            ${archivosCount} archivo${archivosCount > 1 ? 's' : ''}
        </button>` : 
        '<span class="no-attachments">Sin archivos</span>';
    
    row.innerHTML = `
        <td>${fechaReporte}</td>
        <td>${fechaIncidente}</td>
        <td>${fechaInicialIncidente}</td>
        <td>${fechaFinalIncidente}</td>
        <td>${report.anonimo ? 'Anonimo' : (report.nombre || 'N/A')}</td>
        <td>${report.anonimo ? 'Anonimo' : (report.email || 'N/A')}</td>
        <td>${report.anonimo ? 'Anonimo' : (report.telefono || 'N/A')}</td>
        <td>${report.empresa || 'N/A'}</td>
        <td>${report.cargo || 'N/A'}</td>
        <td>${report.relacion || 'N/A'}</td>
        <td>${report.area || 'N/A'}</td>
        <td>${report.puntoVenta || 'N/A'}</td>
        <td><span class="tipo-badge tipo-${report.tipo}">${tipoFormatted}</span></td>
        <td class="asunto-cell" title="${report.asunto || ''}">${truncateText(report.asunto || '', 50)}</td>
        <td class="mensaje-cell" title="${report.mensaje || ''}">${truncateText(report.mensaje || '', 100)}</td>
        <td>${report.anonimo ? 'Si' : 'No'}</td>
        <td>${archivosBtn}</td>
        <td><span class="estado-badge estado-${report.estado}">${estadoFormatted}</span></td>
        <td>
            <div class="action-buttons">
                <button class="action-btn view-btn" onclick="viewReport(${report.id})" title="Ver detalles">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="action-btn edit-btn" onclick="editReport(${report.id})" title="Editar estado">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Actualizar metricas del dashboard
function updateMetrics() {
    const totalReports = document.getElementById('totalReports');
    const pendingReports = document.getElementById('pendingReports');
    const resolvedReports = document.getElementById('resolvedReports');
    const avgResponseTime = document.getElementById('avgResponseTime');
    
    if (!totalReports) return;
    
    // Total de reportes
    totalReports.textContent = filteredReports.length;
    
    // Reportes pendientes
    const pending = filteredReports.filter(r => r.estado === 'pendiente' || r.estado === 'en_revision').length;
    if (pendingReports) pendingReports.textContent = pending;
    
    // Reportes resueltos
    const resolved = filteredReports.filter(r => r.estado === 'resuelto' || r.estado === 'cerrado').length;
    if (resolvedReports) resolvedReports.textContent = resolved;
    
    // Tiempo promedio de respuesta (simulado)
    const avgTime = filteredReports.length > 0 ? Math.floor(Math.random() * 10) + 5 : 0;
    if (avgResponseTime) avgResponseTime.textContent = avgTime;
}

// Funciones de utilidad
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
}

function formatTipo(tipo) {
    const tipos = {
        'acoso': 'Acoso',
        'conflicto_interes': 'Conflicto de Interes',
        'corrupcion': 'Corrupcion',
        'discriminacion': 'Discriminacion',
        'fraude': 'Fraude',
        'incumplimiento_normas': 'Incumplimiento de Normas',
        'mal_uso_recursos': 'Mal Uso de Recursos',
        'nepotismo': 'Nepotismo',
        'otro': 'Otro'
    };
    return tipos[tipo] || tipo;
}

function formatEstado(estado) {
    const estados = {
        'pendiente': 'Pendiente',
        'en_revision': 'En Revision',
        'resuelto': 'Resuelto',
        'cerrado': 'Cerrado'
    };
    return estados[estado] || estado;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Funcion debounce para optimizar busquedas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Funciones de acciones
function viewReport(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (!report) {
        showError('Reporte no encontrado');
        return;
    }
    
    // Aqui se podria abrir un modal con los detalles completos
    alert(`Detalles del reporte #${reportId}:\n\nAsunto: ${report.asunto}\nMensaje: ${report.mensaje}\nEstado: ${formatEstado(report.estado)}`);
}

function editReport(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (!report) {
        showError('Reporte no encontrado');
        return;
    }
    
    // Aqui se podria abrir un modal para editar el estado
    const newStatus = prompt(`Cambiar estado del reporte #${reportId}:\n\nEstado actual: ${formatEstado(report.estado)}\n\nNuevo estado (pendiente/en_revision/resuelto/cerrado):`);
    
    if (newStatus && ['pendiente', 'en_revision', 'resuelto', 'cerrado'].includes(newStatus)) {
        report.estado = newStatus;
        updateReportsTable();
        updateMetrics();
        showSuccess('Estado actualizado correctamente');
    }
}

function viewAttachments(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (!report || !report.archivos || report.archivos.length === 0) {
        showError('No hay archivos adjuntos para este reporte');
        return;
    }
    
    // Abrir modal de archivos adjuntos
    openAttachmentModal(report);
}

// Funciones del modal de archivos adjuntos
function openAttachmentModal(report) {
    const modal = document.getElementById('attachmentModal');
    const modalTitle = document.getElementById('modalTitle');
    const attachmentList = document.getElementById('attachmentList');
    const previewContainer = document.getElementById('previewContainer');
    
    if (!modal || !modalTitle || !attachmentList || !previewContainer) {
        console.error('Elementos del modal no encontrados');
        return;
    }
    
    // Configurar titulo
    modalTitle.textContent = `Archivos adjuntos - Reporte #${report.id}`;
    
    // Limpiar contenido previo
    attachmentList.innerHTML = '';
    previewContainer.innerHTML = '<p class="preview-placeholder">Selecciona un archivo para ver la vista previa</p>';
    
    // Agregar archivos a la lista
    report.archivos.forEach((archivo, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'attachment-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-name">${archivo}</span>
                <span class="file-size">Tamano desconocido</span>
            </div>
            <div class="file-actions">
                <button class="preview-btn" onclick="previewFile('${archivo}', ${index})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Vista previa
                </button>
                <button class="download-btn" onclick="downloadFile('${archivo}', ${report.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7,10 12,15 17,10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Descargar
                </button>
            </div>
        `;
        attachmentList.appendChild(fileItem);
    });
    
    // Mostrar modal
    modal.style.display = 'block';
    
    // Agregar event listener para cerrar con click fuera del modal
    modal.onclick = function(event) {
        if (event.target === modal) {
            closeAttachmentModal();
        }
    };
}

function closeAttachmentModal() {
    const modal = document.getElementById('attachmentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function previewFile(fileName, index) {
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) return;
    
    // Simular vista previa segun el tipo de archivo
    const extension = fileName.split('.').pop().toLowerCase();
    
    let previewContent = '';
    
    switch (extension) {
        case 'pdf':
            previewContent = `
                <div class="file-preview pdf-preview">
                    <div class="preview-header">
                        <h4>${fileName}</h4>
                        <span class="file-type">Documento PDF</span>
                    </div>
                    <div class="pdf-placeholder">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10,9 9,9 8,9"></polyline>
                        </svg>
                        <p>Vista previa de PDF no disponible</p>
                        <p>Haz clic en "Descargar" para ver el archivo completo</p>
                    </div>
                </div>
            `;
            break;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
            previewContent = `
                <div class="file-preview image-preview">
                    <div class="preview-header">
                        <h4>${fileName}</h4>
                        <span class="file-type">Imagen ${extension.toUpperCase()}</span>
                    </div>
                    <div class="image-placeholder">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21,15 16,10 5,21"></polyline>
                        </svg>
                        <p>Vista previa de imagen no disponible</p>
                        <p>Haz clic en "Descargar" para ver la imagen completa</p>
                    </div>
                </div>
            `;
            break;
        default:
            previewContent = `
                <div class="file-preview generic-preview">
                    <div class="preview-header">
                        <h4>${fileName}</h4>
                        <span class="file-type">Archivo ${extension.toUpperCase()}</span>
                    </div>
                    <div class="generic-placeholder">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                        </svg>
                        <p>Vista previa no disponible para este tipo de archivo</p>
                        <p>Haz clic en "Descargar" para abrir el archivo</p>
                    </div>
                </div>
            `;
    }
    
    previewContainer.innerHTML = previewContent;
}

function downloadFile(fileName, reportId) {
    // Simular descarga de archivo
    showInfo(`Descargando archivo: ${fileName}`);
    
    // En una implementacion real, aqui se haria una peticion al servidor
    // para obtener el archivo y descargarlo
    console.log(`Descargando archivo ${fileName} del reporte ${reportId}`);
}

// Funcion para exportar a Excel
function exportToExcel() {
    if (filteredReports.length === 0) {
        showError('No hay datos para exportar');
        return;
    }
    
    try {
        // Preparar datos para Excel
        const excelData = filteredReports.map(report => ({
            'Fecha Reporte': formatDate(report.fechaReporte),
            'Fecha Incidente': formatDate(report.fechaIncidente),
            'Fecha Inicial Incidente': formatDate(report.fechaInicialIncidente),
            'Fecha Final Incidente': formatDate(report.fechaFinalIncidente),
            'Nombre': report.anonimo ? 'Anonimo' : (report.nombre || 'N/A'),
            'Email': report.anonimo ? 'Anonimo' : (report.email || 'N/A'),
            'Telefono': report.anonimo ? 'Anonimo' : (report.telefono || 'N/A'),
            'Empresa': report.empresa || 'N/A',
            'Cargo': report.cargo || 'N/A',
            'Relacion': report.relacion || 'N/A',
            'Area': report.area || 'N/A',
            'Punto de Venta': report.puntoVenta || 'N/A',
            'Tipo': formatTipo(report.tipo),
            'Asunto': report.asunto || 'N/A',
            'Mensaje': report.mensaje || 'N/A',
            'Anonimo': report.anonimo ? 'Si' : 'No',
            'Archivos': report.archivos ? report.archivos.length : 0,
            'Estado': formatEstado(report.estado)
        }));
        
        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Ajustar ancho de columnas
        const colWidths = [
            { wch: 15 }, // Fecha Reporte
            { wch: 15 }, // Fecha Incidente
            { wch: 20 }, // Fecha Inicial Incidente
            { wch: 20 }, // Fecha Final Incidente
            { wch: 20 }, // Nombre
            { wch: 25 }, // Email
            { wch: 15 }, // Telefono
            { wch: 15 }, // Empresa
            { wch: 20 }, // Cargo
            { wch: 15 }, // Relacion
            { wch: 25 }, // Area
            { wch: 20 }, // Punto de Venta
            { wch: 20 }, // Tipo
            { wch: 40 }, // Asunto
            { wch: 50 }, // Mensaje
            { wch: 10 }, // Anonimo
            { wch: 10 }, // Archivos
            { wch: 15 }  // Estado
        ];
        ws['!cols'] = colWidths;
        
        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Reportes');
        
        // Generar nombre de archivo con fecha
        const now = new Date();
        const fileName = `reportes_linea_etica_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.xlsx`;
        
        // Descargar archivo
        XLSX.writeFile(wb, fileName);
        
        showSuccess(`Archivo exportado: ${fileName}`);
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        showError('Error al exportar los datos. Por favor, intenta de nuevo.');
    }
}

// Funciones de notificacion
function showLoading(show) {
    // Implementar indicador de carga
    console.log(show ? 'Mostrando carga...' : 'Ocultando carga...');
}

function showError(message) {
    console.error('Error:', message);
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log('Exito:', message);
    alert('Exito: ' + message);
}

function showInfo(message) {
    console.log('Info:', message);
    alert('Info: ' + message);
}

// Funcion de logout
function logout() {
    // Limpiar datos de autenticacion
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    // Redirigir al login
    window.location.href = 'login.html';
}

// Cerrar modal con tecla Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAttachmentModal();
    }
});