document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ethicsForm');
    const anonymousToggle = document.getElementById('anonymousToggle');
    const personalInfo = document.getElementById('personalInfo');
    const nameField = document.getElementById('name');
    const emailField = document.getElementById('email');
    const phoneField = document.getElementById('phone');
    const positionField = document.getElementById('position');
    const companyField = document.getElementById('company');
    const areaField = document.getElementById('area');
    const puntosVentaField = document.getElementById('puntos_venta');
    const incidentDateField = document.getElementById('incident_date');

    // Función para obtener parámetros de la URL
    function getURLParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Prellenar el campo empresa desde la URL
    function setCompanyFromURL() {
        const empresaParam = getURLParameter('empresa');
        if (empresaParam) {
            const empresaDecoded = decodeURIComponent(empresaParam);
            companyField.value = empresaDecoded;
            
            companyField.readOnly = true;
            companyField.style.backgroundColor = '#f8f9fa';
            companyField.style.cursor = 'not-allowed';
            
            const companyGroup = companyField.closest('.form-group');
            if (companyGroup) {
                const label = companyGroup.querySelector('label');
                if (label && !label.querySelector('.auto-filled')) {
                    const indicator = document.createElement('span');
                    indicator.className = 'auto-filled';
                    indicator.style.color = '#28a745';
                    indicator.style.fontSize = '0.8em';
                    indicator.style.marginLeft = '5px';
                    indicator.textContent = '(Auto-completado)';
                    label.appendChild(indicator);
                }
            }
            
            console.log('Campo empresa prellenado con:', empresaDecoded);
        }
    }

    // Función para permitir edición del campo empresa
    function enableCompanyEdit() {
        const empresaParam = getURLParameter('editable');
        if (empresaParam === 'true' && companyField.readOnly) {
            companyField.readOnly = false;
            companyField.style.backgroundColor = '';
            companyField.style.cursor = '';
            
            const indicator = document.querySelector('.auto-filled');
            if (indicator) {
                indicator.textContent = '(Editable)';
                indicator.style.color = '#ffc107';
            }
        }
    }

    // Mapeo de empresas a archivos PDF de autorización
    const empresaPDFMap = {
        'Centromotos': 'AUTORIZACION-CENTROMOTOS.pdf',
        'Distrimotos': 'AUTORIZACION-Distrimotos.pdf',
        'Credimotos': 'AUTORIZACION-CREDIMOTOS.pdf',
        'Credimovil': 'AUTORIZACION-Credimovil.pdf',
        'Motomovil': 'AUTORIZACION-Motomovil.pdf',
        'Sabanamotos': 'AUTORIZACION-Sabanamotos.pdf',
        'Motocredito': 'AUTORIZACION-Motocredito.pdf',
        'Motos Del Aburra': 'AUTORIZACION-MotosDelAburra.pdf',
        'Fintotal': 'AUTORIZACION-FINTOTAL.pdf',
        'Motoracing': 'AUTORIZACION-Motoracing.pdf',
        'Motos Del Darien': 'AUTORIZACION-MotosDelDarien.pdf'
    };

    // Función para mostrar PDF de autorización según la empresa
    function showCompanyAuthorizationPDF(empresa) {
        const pdfContainer = document.getElementById('pdfAuthorizationContainer');
        const pdfLabel = document.getElementById('pdfAuthorizationLabel');
        const companyNameSpan = document.getElementById('companyName');
        
        if (empresa && empresaPDFMap[empresa]) {
            const pdfFileName = empresaPDFMap[empresa];
            const pdfPath = `./${pdfFileName}`;
            
            // Mostrar el contenedor del PDF
            pdfContainer.style.display = 'block';
            
            // Actualizar el nombre de la empresa en el label
            companyNameSpan.textContent = empresa;
            
            // Configurar el evento de clic para abrir el PDF
            pdfLabel.onclick = function() {
                window.open(pdfPath, '_blank');
            };
            
            // Agregar cursor pointer para indicar que es clickeable
            pdfLabel.style.cursor = 'pointer';
            
            console.log(`PDF de autorización configurado para ${empresa}: ${pdfFileName}`);
        } else {
            // Ocultar el contenedor si no hay empresa seleccionada o no existe PDF
            pdfContainer.style.display = 'none';
            
            // Limpiar el evento de clic
            if (pdfLabel) {
                pdfLabel.onclick = null;
                pdfLabel.style.cursor = 'default';
            }
            
            if (empresa) {
                console.log(`No se encontró PDF de autorización para la empresa: ${empresa}`);
            }
        }
    }

    // Función para manejar la activación del campo Punto de Venta
    function handlePuntosVentaActivation() {
        const empresaValue = companyField.value;
        const areaValue = areaField.value;
        
        console.log('Empresa:', empresaValue, 'Área:', areaValue);
        
        // Mostrar PDF de autorización según la empresa seleccionada
        showCompanyAuthorizationPDF(empresaValue);
        
        const empresasConPuntosVenta = [
            'Centromotos', 'Distrimotos', 'Credimotos', 'Credimovil', 'Motomovil', 
            'Sabanamotos', 'Motocredito', 'Motos Del Aburra', 'Fintotal', 
            'Motoracing', 'Motos Del Darien'
        ];
        
        if (areaValue === 'comercial_venta_posventa' && empresasConPuntosVenta.includes(empresaValue)) {
            puntosVentaField.disabled = false;
            puntosVentaField.classList.remove('disabled-field');
            
            console.log('Activando campo puntos de venta para:', empresaValue);
            
            const options = puntosVentaField.querySelectorAll('option');
            options.forEach(option => {
                if (option.value === '') {
                    option.style.display = 'block';
                } else if (option.dataset.empresa === empresaValue) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            });
            
            const currentValue = puntosVentaField.value;
            const currentOption = puntosVentaField.querySelector(`option[value="${currentValue}"]`);
            if (currentValue && (!currentOption || currentOption.dataset.empresa !== empresaValue)) {
                puntosVentaField.value = '';
            }
        } else {
            puntosVentaField.disabled = true;
            puntosVentaField.classList.add('disabled-field');
            puntosVentaField.value = '';
            
            console.log('Desactivando campo puntos de venta');
            
            const options = puntosVentaField.querySelectorAll('option');
            options.forEach(option => {
                option.style.display = 'block';
            });
        }
    }

    // Función para manejar el modo anónimo
    function toggleAnonymousMode(isAnonymous) {
        // Campos que se ocultan en modo anónimo
        // Actualizar la lista fieldsToHide para incluir los nuevos campos
        const fieldsToHide = [
            nameField.closest('.form-group'),
            emailField.closest('.form-group'),
            phoneField.closest('.form-group'),
            companyField.closest('.form-group'),
            areaField.closest('.form-group'),
            puntosVentaField.closest('.form-group'),
            incidentDateField.closest('.form-group'), // Fecha del incidente
            document.getElementById('single-date-group'), // Grupo fecha única
            document.getElementById('date-range-group'), // Grupo rango fechas
            document.getElementById('pdfAuthorizationContainer') // Contenedor PDF
        ];
    
        if (isAnonymous) {
            // Ocultar información personal usando la clase específica
            personalInfo.classList.add('hidden');
            
            // Ocultar otros campos usando la clase general
            fieldsToHide.forEach(field => {
                if (field) {
                    field.classList.add('hidden');
                }
            });

            // Ocultar específicamente el PDF de autorización
            showCompanyAuthorizationPDF('');
    
            // Remover atributos required de campos ocultos
            nameField.removeAttribute('required');
            emailField.removeAttribute('required');
            companyField.removeAttribute('required');
            areaField.removeAttribute('required');
            
            // Limpiar valores de campos ocultos
            nameField.value = '';
            emailField.value = '';
            document.getElementById('phone').value = '';
            companyField.value = '';
            areaField.value = '';
            puntosVentaField.value = '';
            incidentDateField.value = '';
            
            console.log('Modo anónimo activado - Solo campos permitidos visibles');
        } else {
            // Mostrar información personal
            personalInfo.classList.remove('hidden');
            
            // Mostrar otros campos
            fieldsToHide.forEach(field => {
                if (field) {
                    field.classList.remove('hidden');
                }
            });
    
            // Restaurar atributos required
            nameField.setAttribute('required', 'required');
            emailField.setAttribute('required', 'required');
            companyField.setAttribute('required', 'required');
            areaField.setAttribute('required', 'required');
            
            // Restaurar empresa desde URL si existe
            setCompanyFromURL();
            
            console.log('Modo anónimo desactivado - Todos los campos visibles');
        }
    }

    // Ejecutar las funciones de inicialización
    setCompanyFromURL();
    enableCompanyEdit();
    
    // Event listeners
    companyField.addEventListener('input', handlePuntosVentaActivation);
    companyField.addEventListener('change', handlePuntosVentaActivation);
    areaField.addEventListener('change', handlePuntosVentaActivation);
    
    // Ejecutar la validación inicial después de configurar la empresa
    setTimeout(handlePuntosVentaActivation, 100);

    // Manejar toggle anónimo con la nueva funcionalidad
    anonymousToggle.addEventListener('change', function() {
        toggleAnonymousMode(this.checked);
    });

    // Manejar envío del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validación básica del formulario HTML5
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Validar archivos
        const fileInput = document.getElementById('attachments');
        const files = fileInput.files;
        
        for (let file of files) {
            if (file.size > 5 * 1024 * 1024) { // 5MB
                showError('Uno o más archivos exceden el tamaño máximo de 5MB');
                return;
            }
        }

        // Mostrar modal de carga
        showModal('loadingModal');

        try {
            const formData = new FormData(form);
            formData.append('anonymous', anonymousToggle.checked);

            const response = await fetch('/api/submit-report', {
                method: 'POST',
                body: formData
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            let result;
            try {
                result = await response.json();
                console.log('Response data:', result);
            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                hideModal('loadingModal');
                showError('Error de formato en la respuesta del servidor');
                return;
            }

            hideModal('loadingModal');

            if (response.ok && result.success) {
                showModal('successModal');
                form.reset();
                // Restaurar estado inicial según el modo anónimo
                toggleAnonymousMode(false);
                anonymousToggle.checked = false;
            } else {
                console.error('Server error:', result);
                showError(result.message || 'Error al enviar el reporte');
            }
        } catch (error) {
            hideModal('loadingModal');
            showError('Error de conexión. Por favor, intente nuevamente.');
            console.error('Error:', error);
        }
    });

    // Validación en tiempo real
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.style.borderColor = '#e74c3c';
            } else {
                this.style.borderColor = '#e1e8ed';
            }
        });
    });
    
    // Inicializar funcionalidades
    initializeDateTypeHandler();
    initializeAdminFunctionality();
});

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function closeModal(modalId) {
    hideModal(modalId);
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    showModal('errorModal');
}

window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Agregar al final del archivo, antes del último }

// Manejo de tipo de fecha (única vs rango)
function initializeDateTypeHandler() {
    const dateTypeRadios = document.querySelectorAll('input[name="date_type"]');
    const singleDateGroup = document.getElementById('single-date-group');
    const dateRangeGroup = document.getElementById('date-range-group');
    const incidentDate = document.getElementById('incident_date');
    const incidentDateInitial = document.getElementById('incident_date_initial');
    const incidentDateEnd = document.getElementById('incident_date_end');

    function toggleDateFields() {
        const selectedType = document.querySelector('input[name="date_type"]:checked').value;
        
        if (selectedType === 'single') {
            singleDateGroup.style.display = 'block';
            dateRangeGroup.style.display = 'none';
            
            // Hacer obligatorio el campo de fecha única
            incidentDate.required = true;
            incidentDateInitial.required = false;
            incidentDateEnd.required = false;
            
            // Limpiar campos de rango
            incidentDateInitial.value = '';
            incidentDateEnd.value = '';
        } else {
            singleDateGroup.style.display = 'none';
            dateRangeGroup.style.display = 'block';
            
            // Hacer obligatorios los campos de rango
            incidentDate.required = false;
            incidentDateInitial.required = true;
            incidentDateEnd.required = true;
            
            // Limpiar campo de fecha única
            incidentDate.value = '';
        }
    }

    // Agregar event listeners
    dateTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleDateFields);
    });

    // Validación adicional para rango de fechas
    incidentDateEnd.addEventListener('change', function() {
        if (incidentDateInitial.value && incidentDateEnd.value) {
            if (new Date(incidentDateEnd.value) < new Date(incidentDateInitial.value)) {
                alert('La fecha final no puede ser anterior a la fecha inicial');
                incidentDateEnd.value = '';
            }
        }
    });

    incidentDateInitial.addEventListener('change', function() {
        if (incidentDateInitial.value && incidentDateEnd.value) {
            if (new Date(incidentDateEnd.value) < new Date(incidentDateInitial.value)) {
                alert('La fecha final no puede ser anterior a la fecha inicial');
                incidentDateEnd.value = '';
            }
        }
    });
}

// Llamar la función cuando se carga la página
// Consolidado en el evento DOMContentLoaded principal

// Funcionalidad del Admin
function initializeAdminFunctionality() {
    const adminBtn = document.getElementById('adminBtn');
    const adminModal = document.getElementById('adminModal');
    const adminForm = document.getElementById('adminForm');
    const usernameField = document.getElementById('adminUsername');
    const passwordField = document.getElementById('adminPassword');
    
    // Abrir modal de admin
    adminBtn.addEventListener('click', function() {
        showModal('adminModal');
        // Limpiar campos y errores al abrir
        adminForm.reset();
        clearFieldErrors();
    });
    
    // Validación en tiempo real para campos de admin
    usernameField.addEventListener('input', function() {
        validateEmailField(this);
    });
    
    usernameField.addEventListener('blur', function() {
        validateEmailField(this);
    });
    
    passwordField.addEventListener('input', function() {
        validatePasswordField(this);
    });
    
    passwordField.addEventListener('blur', function() {
        validatePasswordField(this);
    });
    
    // Manejar envío del formulario de admin
    adminForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = usernameField.value.trim();
        const password = passwordField.value;
        
        // Validar campos antes del envío
        const isUsernameValid = validateEmailField(usernameField);
        const isPasswordValid = validatePasswordField(passwordField);
        
        if (!isUsernameValid || !isPasswordValid) {
            return;
        }
        
        // Enviar credenciales al servidor para autenticación
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: username,
                    password: password
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Autenticación exitosa
                sessionStorage.setItem('adminAuthenticated', 'true');
                sessionStorage.setItem('userInfo', JSON.stringify(result.user));
                
                // Limpiar errores
                clearFieldError(usernameField);
                clearFieldError(passwordField);
                
                // Redirigir al dashboard
                closeModal('adminModal');
                window.location.href = 'dashboard.html';
            } else {
                // Credenciales incorrectas
                showFieldError(usernameField, result.message || 'Usuario o contraseña incorrectos');
                showFieldError(passwordField, '');
            }
        } catch (error) {
            console.error('Error en autenticación:', error);
            showFieldError(usernameField, 'Error de conexión. Intente nuevamente.');
            showFieldError(passwordField, '');
        }
    });
}

// Función para validar campo de email
function validateEmailField(field) {
    const value = field.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!value) {
        showFieldError(field, 'El usuario es requerido');
        return false;
    } else if (!emailRegex.test(value)) {
        showFieldError(field, 'Ingrese un email válido');
        return false;
    } else {
        clearFieldError(field);
        return true;
    }
}

// Función para validar campo de contraseña
function validatePasswordField(field) {
    const value = field.value;
    
    if (!value) {
        showFieldError(field, 'La contraseña es requerida');
        return false;
    } else if (value.length < 6) {
        showFieldError(field, 'La contraseña debe tener al menos 6 caracteres');
        return false;
    } else {
        clearFieldError(field);
        return true;
    }
}

// Función para mostrar error en campo
function showFieldError(field, message) {
    clearFieldError(field);
    
    if (message) {
        field.style.borderColor = '#ef4444';
        field.style.background = '#fef2f2';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            color: #ef4444;
            font-size: 12px;
            margin-top: 5px;
            font-weight: 500;
        `;
        
        field.parentNode.appendChild(errorDiv);
    }
}

// Función para limpiar error de campo
function clearFieldError(field) {
    field.style.borderColor = '';
    field.style.background = '';
    
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

// Función para limpiar todos los errores de campos
function clearFieldErrors() {
    const errorElements = document.querySelectorAll('.field-error');
    errorElements.forEach(error => error.remove());
    
    const fields = document.querySelectorAll('#adminModal input');
    fields.forEach(field => {
        field.style.borderColor = '';
        field.style.background = '';
    });
}