// Dynamis - Main Application Logic
import { db } from './firebase-config.js';

// --- STATE MANAGEMENT ---
let currentUser = null;
let carouselIndex = 0;
let carouselInterval = null;

// --- DOM ELEMENTS ---
const elements = {
    // Navigation
    navMenu: document.getElementById('nav-menu'),
    navToggle: document.getElementById('nav-toggle'),
    navLinks: document.querySelectorAll('.nav-link'),
    logoBtn: document.getElementById('logo-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    navProfile: document.getElementById('nav-profile'),
    profileBadgeRole: document.getElementById('profile-badge-role'),
    navLoginBtn: document.getElementById('nav-login-btn'),
    
    // Sections
    sections: document.querySelectorAll('.app-section'),
    
    // Forms
    registerForm: document.getElementById('register-form'),
    registerMemberForm: document.getElementById('register-member-form'),
    loginForm: document.getElementById('login-form'),
    generalThemeForm: document.getElementById('general-theme-form'),
    generalDocForm: document.getElementById('general-doc-form'),
    areaMemberForm: document.getElementById('area-member-form'),
    areaMeetingForm: document.getElementById('area-meeting-form'),
    
    // General Dashboard
    generalMeetingsTable: document.getElementById('general-meetings-table')?.querySelector('tbody'),
    generalMembersTable: document.getElementById('general-members-table')?.querySelector('tbody'),
    generalActiveUsers: document.getElementById('general-active-users'),
    generalUploadedDocs: document.getElementById('general-uploaded-docs'),
    generalWelcome: document.getElementById('general-welcome'),
    docFileInput: document.getElementById('doc-file'),
    fileNameChosen: document.getElementById('file-name-chosen'),
    unifiedRegCard: document.getElementById('unified-registration-card'),
    unifiedRegForm: document.getElementById('unified-registration-form'),
    unifiedRoleSelect: document.getElementById('unified-role'),
    unifiedGroupLinkSelect: document.getElementById('unified-group-link'),
    
    // Group Dashboard
    groupTitle: document.getElementById('group-title'),
    groupWelcome: document.getElementById('group-welcome'),
    groupAreasTable: document.getElementById('group-areas-table')?.querySelector('tbody'),
    groupMeetingsCompact: document.getElementById('group-meetings-compact'),
    groupCreateAreaForm: document.getElementById('group-create-area-form'),
    
    // Area Dashboard
    areaTitle: document.getElementById('area-title'),
    areaWelcome: document.getElementById('area-welcome'),
    areaMembersList: document.getElementById('area-members-list'),
    areaMeetingsScheduled: document.getElementById('area-meetings-scheduled'),
    areaDownloadableDocs: document.getElementById('area-downloadable-docs'),
    meetThemeSelect: document.getElementById('meet-theme'),
    
    // Carousel
    carouselSlides: document.getElementById('carousel-slides'),
    carouselPrev: document.getElementById('carousel-prev'),
    carouselNext: document.getElementById('carousel-next'),
    carouselDots: document.getElementById('carousel-dots')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Increment visit count on entry
    let visits = parseInt(localStorage.getItem('dynamis_visits_count') || '0');
    visits++;
    localStorage.setItem('dynamis_visits_count', visits.toString());

    initRouter();
    initCarousel();
    initMobileNav();
    checkSession();
    updateFooterStats();
    populateRegMemberAreaSelect();
    setupEventListeners();
});

// Update connection and visit counts in footer
async function updateFooterStats() {
    try {
        const allUsers = await db.getCollection('users');
        const onlineCount = allUsers.filter(u => u.conectado === true).length;
        const visitsCount = localStorage.getItem('dynamis_visits_count') || '0';
        
        const onlineEl = document.getElementById('footer-online-count');
        const visitsEl = document.getElementById('footer-visits-count');
        
        if (onlineEl) onlineEl.textContent = onlineCount;
        if (visitsEl) visitsEl.textContent = visitsCount;
    } catch (e) {
        console.error("Error updating footer stats:", e);
    }
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icon mapping
    let icon = '';
    if (type === 'success') {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;color:var(--color-success)"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;color:var(--color-danger)"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;color:var(--color-cyan)"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 50);

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// --- ROUTER (SPA) ---
function initRouter() {
    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);
    
    // Initial route
    handleRoute();
}

function handleRoute() {
    const hash = window.location.hash || '#home';
    const sectionId = hash.substring(1);
    
    // Validation: prevent accessing dashboards without login
    if (sectionId.startsWith('dashboard-')) {
        if (!currentUser) {
            window.location.hash = '#login';
            showToast('Debe iniciar sesión para acceder al panel', 'error');
            return;
        }
        
        // Match dashboard to role
        const role = currentUser.rol;
        if (sectionId === 'dashboard-general' && role !== 'general' && role !== 'admin') {
            window.location.hash = `#dashboard-${role === 'admin' ? 'general' : role}`;
            return;
        }
        if (sectionId === 'dashboard-grupo' && role !== 'grupo') {
            window.location.hash = `#dashboard-${role}`;
            return;
        }
        if (sectionId === 'dashboard-area' && role !== 'area') {
            window.location.hash = `#dashboard-${role}`;
            return;
        }
    }

    // Hide all sections, show current
    elements.sections.forEach(sec => {
        sec.classList.remove('active');
        if (sec.id === sectionId) {
            sec.classList.add('active');
        }
    });

    // Update navbar active state
    elements.navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === hash) {
            link.classList.add('active');
        }
    });

    // Load data for dashboards if active
    if (sectionId === 'dashboard-general') {
        loadGeneralDashboard();
    } else if (sectionId === 'dashboard-grupo') {
        loadGroupDashboard();
    } else if (sectionId === 'dashboard-area') {
        loadAreaDashboard();
    }

    // Scroll to top
    window.scrollTo(0, 0);
}

// --- CHECK SESSION ---
function checkSession() {
    const session = sessionStorage.getItem('dynamis_session');
    if (session) {
        currentUser = JSON.parse(session);
        updateNavState(true);
        // Set user online upon reload if session exists
        setConnectionStatus(currentUser.uid, true);
    } else {
        updateNavState(false);
    }
}

// Helper to update connection status
async function setConnectionStatus(userId, isConnected) {
    try {
        const timestamp = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        await db.updateDoc('users', userId, { 
            conectado: isConnected, 
            ultimaConexion: isConnected ? timestamp : (currentUser?.ultimaConexion || '--')
        });
        await updateFooterStats();
    } catch (e) {
        console.error("Error updating connection status:", e);
    }
}

// Browser close presence handler
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        // Direct synchronous update to local storage cache to guarantee persistence on exit
        const data = JSON.parse(localStorage.getItem('dynamis_local_db'));
        if (data && data.users) {
            const uIdx = data.users.findIndex(u => u.uid === currentUser.uid);
            if (uIdx !== -1) {
                data.users[uIdx].conectado = false;
                localStorage.setItem('dynamis_local_db', JSON.stringify(data));
            }
        }
    }
});

function updateNavState(isLoggedIn) {
    if (isLoggedIn && currentUser) {
        elements.navProfile.classList.remove('hidden');
        elements.navLoginBtn.classList.add('hidden');
        elements.profileBadgeRole.textContent = getRoleName(currentUser.rol);
        
        // Change login link in nav to point to dashboard
        elements.navLoginBtn.textContent = 'Dashboard';
        elements.navLoginBtn.setAttribute('href', `#dashboard-${currentUser.rol === 'admin' ? 'general' : currentUser.rol}`);
        elements.navLoginBtn.classList.remove('hidden');
    } else {
        elements.navProfile.classList.add('hidden');
        elements.navLoginBtn.textContent = 'Acceder';
        elements.navLoginBtn.setAttribute('href', '#login');
        elements.navLoginBtn.classList.remove('hidden');
    }
}

function getRoleName(role) {
    if (role === 'general') return 'Líder General';
    if (role === 'admin') return 'Super Admin';
    if (role === 'grupo') return 'Líder de Grupo';
    if (role === 'area') return 'Líder de Área';
    return role;
}

// --- CAROUSEL ---
function initCarousel() {
    const slides = elements.carouselSlides ? elements.carouselSlides.querySelectorAll('.slide') : [];
    const dots = elements.carouselDots ? elements.carouselDots.querySelectorAll('.dot') : [];
    if (slides.length === 0) return;

    function goToSlide(index) {
        slides[carouselIndex].classList.remove('active');
        dots[carouselIndex].classList.remove('active');
        
        carouselIndex = (index + slides.length) % slides.length;
        
        slides[carouselIndex].classList.add('active');
        dots[carouselIndex].classList.add('active');
    }

    // Next slide
    elements.carouselNext?.addEventListener('click', () => {
        goToSlide(carouselIndex + 1);
        resetCarouselTimer();
    });

    // Prev slide
    elements.carouselPrev?.addEventListener('click', () => {
        goToSlide(carouselIndex - 1);
        resetCarouselTimer();
    });

    // Dots click listener
    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            goToSlide(idx);
            resetCarouselTimer();
        });
    });

    // Start auto-play
    startCarouselTimer();
}

function startCarouselTimer() {
    const slides = elements.carouselSlides ? elements.carouselSlides.querySelectorAll('.slide') : [];
    if (slides.length === 0) return;
    
    carouselInterval = setInterval(() => {
        const activeSlide = elements.carouselSlides.querySelector('.slide.active');
        const activeIndex = Array.from(slides).indexOf(activeSlide);
        const nextIndex = (activeIndex + 1) % slides.length;
        
        // Triggers slide change
        activeSlide.classList.remove('active');
        elements.carouselDots.querySelectorAll('.dot')[activeIndex].classList.remove('active');
        
        slides[nextIndex].classList.add('active');
        elements.carouselDots.querySelectorAll('.dot')[nextIndex].classList.add('active');
        
        carouselIndex = nextIndex;
    }, 5000);
}

function resetCarouselTimer() {
    clearInterval(carouselInterval);
    startCarouselTimer();
}

// --- MOBILE NAVIGATION ---
function initMobileNav() {
    elements.navToggle?.addEventListener('click', () => {
        elements.navMenu.classList.toggle('open');
        elements.navToggle.classList.toggle('open');
    });

    // Close menu when clicking navigation link
    elements.navLinks.forEach(link => {
        link.addEventListener('click', () => {
            elements.navMenu.classList.remove('open');
            elements.navToggle.classList.remove('open');
        });
    });
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Logo redirect
    elements.logoBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#home';
    });

    // Logout
    elements.logoutBtn?.addEventListener('click', async () => {
        if (currentUser) {
            await setConnectionStatus(currentUser.uid, false);
        }
        sessionStorage.removeItem('dynamis_session');
        currentUser = null;
        updateNavState(false);
        showToast('Sesión cerrada correctamente', 'info');
        window.location.hash = '#home';
    });

    // Register Form
    elements.registerForm?.addEventListener('submit', handleRegister);

    // Login Form
    elements.loginForm?.addEventListener('submit', handleLogin);

    // General: Add Theme Form
    elements.generalThemeForm?.addEventListener('submit', handleAddTheme);

    // General: Add Doc Form
    elements.generalDocForm?.addEventListener('submit', handleAddDoc);
    
    // File upload mock trigger
    elements.docFileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            elements.fileNameChosen.textContent = file.name;
            elements.fileNameChosen.style.color = 'var(--color-cyan)';
        } else {
            elements.fileNameChosen.textContent = 'Ningún archivo seleccionado';
            elements.fileNameChosen.style.color = 'var(--color-text-muted)';
        }
    });

    // Area: Add Member Form
    elements.areaMemberForm?.addEventListener('submit', handleAddMember);

    // Area: Create Meeting Form
    elements.areaMeetingForm?.addEventListener('submit', handleCreateMeeting);
    
    // Group: Create Area Form
    elements.groupCreateAreaForm?.addEventListener('submit', handleGroupCreateArea);

    // Register Member Form (Participant version)
    elements.registerMemberForm?.addEventListener('submit', handleRegisterMember);

    // Unified: Role selection change listener
    elements.unifiedRoleSelect?.addEventListener('change', (e) => {
        const isArea = e.target.value === 'area';
        const addressGroup = document.getElementById('unified-address-group');
        const linkGroup = document.getElementById('unified-group-link-group');
        const addressInput = document.getElementById('unified-address');
        const linkSelect = document.getElementById('unified-group-link');
        const labelGroupName = document.getElementById('label-group-name');
        const labelLeaderName = document.getElementById('label-leader-name');
        const btnText = document.getElementById('unified-btn-text');

        if (isArea) {
            addressGroup.style.display = 'block';
            linkGroup.style.display = 'block';
            addressInput.required = true;
            linkSelect.required = true;
            labelGroupName.textContent = 'Nombre de la Nueva Área';
            labelLeaderName.textContent = 'Nombre del Líder de Área';
            btnText.textContent = 'Registrar Área y Líder';
        } else {
            addressGroup.style.display = 'none';
            linkGroup.style.display = 'none';
            addressInput.required = false;
            linkSelect.required = false;
            labelGroupName.textContent = 'Nombre del Grupo General';
            labelLeaderName.textContent = 'Nombre del Líder General';
            btnText.textContent = 'Registrar Grupo y Líder';
        }
    });

    // Unified: Group / Leader Registration Form Submission
    elements.unifiedRegForm?.addEventListener('submit', handleUnifiedRegisterSubmit);
    
    // Listen for storage events (updates in mock DB across tabs or components)
    window.addEventListener('storage', () => {
        const hash = window.location.hash || '#home';
        if (hash === '#dashboard-general') loadGeneralDashboard();
        if (hash === '#dashboard-grupo') loadGroupDashboard();
        if (hash === '#dashboard-area') loadAreaDashboard();
        updateFooterStats();
        populateRegMemberAreaSelect();
    });
}

// --- REGISTRATION LOGIC ---
async function handleRegister(e) {
    e.preventDefault();
    
    const groupName = document.getElementById('reg-group-name').value;
    const leaderName = document.getElementById('reg-leader-name').value;
    const address = document.getElementById('reg-address').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const district = document.getElementById('reg-district').value;
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;

    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        // Check if email already exists
        const allUsers = await db.getCollection('users');
        const userExists = allUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (userExists) {
            showToast('El correo electrónico ya está registrado', 'error');
            return;
        }

        // Create new user leader
        const newUser = {
            uid: `usr-${Date.now()}`,
            email: email,
            password: password,
            nombreGrupo: groupName,
            liderName: leaderName,
            direccionReunion: address,
            telefono: phone,
            distrito: district,
            rol: role,
            grupoId: role === 'area' ? 'grupo-surco' : '' // Default parent group for demo
        };

        await db.addDoc('users', newUser);
        showToast('Registro de líder exitoso. ¡Inicia sesión!', 'success');
        elements.registerForm.reset();
        window.location.hash = '#login';
    } catch (err) {
        showToast('Error al registrar usuario: ' + err.message, 'error');
    }
}



// Populate Area select dropdown with active Area Leaders from users collection (Tab Version)
async function populateRegMemberAreaSelect() {
    const select = document.getElementById('reg-mem-area');
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>Selecciona tu área/grupo</option>';
    try {
        const allUsers = await db.getCollection('users');
        const areaLeaders = allUsers.filter(u => u.rol === 'area');
        
        if (areaLeaders.length === 0) {
            select.innerHTML = '<option value="" disabled>No hay áreas de reunión registradas aún</option>';
        } else {
            areaLeaders.forEach(leader => {
                const opt = document.createElement('option');
                opt.value = leader.uid;
                opt.textContent = `${leader.nombreGrupo} (Líder: ${leader.liderName} - ${leader.distrito})`;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Error loading areas for member registration:", e);
        select.innerHTML = '<option value="" disabled>Error al cargar áreas</option>';
    }
}

// Handle member registration submission (Tab Version)
async function handleRegisterMember(e) {
    e.preventDefault();
    
    const name = document.getElementById('reg-mem-name').value;
    const email = document.getElementById('reg-mem-email').value;
    const phone = document.getElementById('reg-mem-phone').value;
    const district = document.getElementById('reg-mem-district').value;
    const areaLiderId = document.getElementById('reg-mem-area').value;

    try {
        const newParticipant = {
            areaLiderId: areaLiderId,
            nombreCompleto: name,
            correo: email || '',
            telefono: phone,
            distrito: district,
            estado: 'activo'
        };

        await db.addDoc('members', newParticipant);
        showToast('¡Registro exitoso! Te has unido al grupo correctamente', 'success');
        elements.registerMemberForm.reset();
        window.location.hash = '#home';
    } catch (err) {
        showToast('Error al registrarse en el grupo: ' + err.message, 'error');
    }
}

// Handle new Area Leader creation by a Group Leader
async function handleGroupCreateArea(e) {
    e.preventDefault();
    
    const areaName = document.getElementById('group-area-name').value;
    const leaderName = document.getElementById('group-area-leader').value;
    const address = document.getElementById('group-area-address').value;
    const email = document.getElementById('group-area-email').value;
    const phone = document.getElementById('group-area-phone').value;
    const district = document.getElementById('group-area-district').value;
    const password = document.getElementById('group-area-password').value;

    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        // Check if email already exists
        const allUsers = await db.getCollection('users');
        const userExists = allUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (userExists) {
            showToast('El correo electrónico ya está registrado', 'error');
            return;
        }

        // Create new Area Leader account linked to this Group Leader
        const newAreaLeader = {
            uid: `usr-${Date.now()}`,
            email: email,
            password: password,
            nombreGrupo: areaName,
            liderName: leaderName,
            direccionReunion: address,
            telefono: phone,
            distrito: district,
            rol: 'area',
            grupoId: currentUser.uid // Assigned to this Group Leader
        };

        await db.addDoc('users', newAreaLeader);
        showToast('¡Área y Líder creados exitosamente!', 'success');
        elements.groupCreateAreaForm.reset();
        
        // Reload dashboard areas list
        loadGroupDashboard();
        // Reload dropdown on registration page
        populateRegMemberAreaSelect();
    } catch (err) {
        showToast('Error al crear el área de reunión: ' + err.message, 'error');
    }
}

// Handle unified registration submission
async function handleUnifiedRegisterSubmit(e) {
    e.preventDefault();
    
    const role = document.getElementById('unified-role').value;
    const groupName = document.getElementById('unified-group-name').value;
    const leaderName = document.getElementById('unified-leader-name').value;
    const email = document.getElementById('unified-email').value;
    const phone = document.getElementById('unified-phone').value;
    const district = document.getElementById('unified-district').value;
    const password = document.getElementById('unified-password').value;

    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        const allUsers = await db.getCollection('users');
        if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            showToast('El correo electrónico ya está registrado', 'error');
            return;
        }

        const newUser = {
            uid: `usr-${Date.now()}`,
            email: email,
            password: password,
            nombreGrupo: groupName,
            liderName: leaderName,
            telefono: phone,
            distrito: district,
            rol: role
        };

        if (role === 'area') {
            const address = document.getElementById('unified-address').value;
            const groupLinkId = document.getElementById('unified-group-link').value;
            newUser.direccionReunion = address;
            newUser.grupoId = groupLinkId;
        } else {
            newUser.direccionReunion = 'Sede Principal';
        }

        await db.addDoc('users', newUser);
        showToast(role === 'area' ? '¡Área y Líder de Área creados con éxito!' : '¡Grupo General creado con éxito!', 'success');
        elements.unifiedRegForm.reset();
        
        loadGeneralDashboard();
        populateRegMemberAreaSelect();
    } catch (err) {
        showToast('Error al registrar: ' + err.message, 'error');
    }
}

// --- LOGIN LOGIC ---
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const user = await db.login(email, password);
        
        if (!user) {
            showToast('Credenciales incorrectas', 'error');
            return;
        }

        // Save session
        currentUser = user;
        sessionStorage.setItem('dynamis_session', JSON.stringify(user));
        
        // Update layout
        updateNavState(true);
        await setConnectionStatus(user.uid, true);
        showToast(`Sesión iniciada como ${user.liderName}`, 'success');
        
        // Redirect to dashboard
        window.location.hash = `#dashboard-${user.rol === 'admin' ? 'general' : user.rol}`;
    } catch (err) {
        showToast('Error de autenticación: ' + err.message, 'error');
    }
}

// ========================================================
// DASHBOARD LOGIC - GENERAL LEADER (Líder General)
// ========================================================
async function loadGeneralDashboard() {
    if (!currentUser) return;
    
    elements.generalWelcome.textContent = `Bienvenido al control central, ${currentUser.liderName}`;
    
    try {
        // Load data from DB
        const meetings = await db.getCollection('meetings');
        const members = await db.getCollection('members');
        const users = await db.getCollection('users');
        const themes = await db.getCollection('themes');
        const docs = await db.getCollection('documents');
        
        // Setup Unified registration form behavior and fields
        const roleGroup = document.getElementById('unified-role-group');
        const roleSelect = document.getElementById('unified-role');
        const addressGroup = document.getElementById('unified-address-group');
        const linkGroup = document.getElementById('unified-group-link-group');
        const labelGroupName = document.getElementById('label-group-name');
        const labelLeaderName = document.getElementById('label-leader-name');
        const btnText = document.getElementById('unified-btn-text');

        if (elements.unifiedGroupLinkSelect) {
            elements.unifiedGroupLinkSelect.innerHTML = '<option value="" disabled selected>Selecciona el grupo supervisor</option>';
            const groupLeaders = users.filter(u => u.rol === 'grupo');
            groupLeaders.forEach(grp => {
                const opt = document.createElement('option');
                opt.value = grp.uid;
                opt.textContent = `${grp.nombreGrupo} (${grp.liderName})`;
                elements.unifiedGroupLinkSelect.appendChild(opt);
            });
        }

        if (roleGroup && roleSelect) {
            if (currentUser.rol === 'admin') {
                roleGroup.style.display = 'block';
                const isArea = roleSelect.value === 'area';
                if (addressGroup) addressGroup.style.display = isArea ? 'block' : 'none';
                if (linkGroup) linkGroup.style.display = isArea ? 'block' : 'none';
                const addrInput = document.getElementById('unified-address');
                if (addrInput) addrInput.required = isArea;
                const linkInput = document.getElementById('unified-group-link');
                if (linkInput) linkInput.required = isArea;
                if (labelGroupName) labelGroupName.textContent = isArea ? 'Nombre de la Nueva Área' : 'Nombre del Grupo General';
                if (labelLeaderName) labelLeaderName.textContent = isArea ? 'Nombre del Líder de Área' : 'Nombre del Líder General';
                if (btnText) btnText.textContent = isArea ? 'Registrar Área y Líder' : 'Registrar Grupo y Líder';
            } else {
                roleGroup.style.display = 'none';
                roleSelect.value = 'area';
                if (addressGroup) addressGroup.style.display = 'block';
                if (linkGroup) linkGroup.style.display = 'block';
                const addrInput = document.getElementById('unified-address');
                if (addrInput) addrInput.required = true;
                const linkInput = document.getElementById('unified-group-link');
                if (linkInput) linkInput.required = true;
                if (labelGroupName) labelGroupName.textContent = 'Nombre de la Nueva Área';
                if (labelLeaderName) labelLeaderName.textContent = 'Nombre del Líder de Área';
                if (btnText) btnText.textContent = 'Registrar Área y Líder';
            }
        }
        // 2. Render Meetings Table
        elements.generalMeetingsTable.innerHTML = '';
        if (meetings.length === 0) {
            elements.generalMeetingsTable.innerHTML = `<tr><td colspan="6" class="text-center" style="text-align:center;padding:30px;color:var(--color-text-muted)">No hay reuniones registradas aún.</td></tr>`;
        } else {
            // Sort meetings by date descending
            meetings.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
            
            meetings.forEach(meet => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${meet.fecha}</strong><br><span style="font-size:0.8rem;color:var(--color-text-muted)">${meet.hora}</span></td>
                    <td>${meet.nombreGrupo}</td>
                    <td><span class="profile-badge">${meet.distrito}</span></td>
                    <td>${meet.direccion}</td>
                    <td><em>${meet.tema}</em></td>
                    <td><strong style="color:var(--color-cyan);font-size:1.1rem">${meet.miembrosReunidosCount}</strong> asistieron</td>
                `;
                elements.generalMeetingsTable.appendChild(tr);
            });
        }

        // 3. Render Documents list with delete button
        elements.generalUploadedDocs.innerHTML = '';
        if (docs.length === 0) {
            elements.generalUploadedDocs.innerHTML = `<li style="padding:10px;text-align:center;color:var(--color-text-muted);font-size:0.85rem">No hay guías subidas.</li>`;
        } else {
            docs.forEach(doc => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px">
                        <svg class="doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        <span>${doc.titulo}</span>
                    </div>
                    <button class="delete-doc-btn" data-id="${doc.id}">Eliminar</button>
                `;
                
                // Add delete listener
                li.querySelector('.delete-doc-btn').addEventListener('click', async (e) => {
                    const docId = e.target.getAttribute('data-id');
                    if (confirm('¿Está seguro de eliminar este documento?')) {
                        await db.deleteDoc('documents', docId);
                        showToast('Documento eliminado', 'info');
                        loadGeneralDashboard();
                    }
                });
                
                elements.generalUploadedDocs.appendChild(li);
            });
        }

        // 4. Render Members Table
        elements.generalMembersTable.innerHTML = '';
        if (members.length === 0) {
            elements.generalMembersTable.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--color-text-muted)">No hay participantes registrados aún.</td></tr>`;
        } else {
            members.forEach(mem => {
                const leader = users.find(u => u.uid === mem.areaLiderId);
                const leaderName = leader ? leader.liderName : 'Desconocido';
                const groupName = leader ? leader.nombreGrupo : 'Sin grupo';
                const district = mem.distrito || (leader ? leader.distrito : 'Sin distrito');

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${mem.nombreCompleto}</strong></td>
                    <td>${mem.telefono}<br><span style="font-size:0.8rem;color:var(--color-text-muted)">${mem.correo || 'Sin correo'}</span></td>
                    <td>${groupName}<br><span class="profile-badge">${district}</span></td>
                    <td><strong>${leaderName}</strong></td>
                    <td><span class="profile-badge" style="background:hsla(145, 80%, 40%, 0.15);color:var(--color-success);border-color:hsla(145, 80%, 40%, 0.3);text-transform:uppercase;font-size:0.7rem">${mem.estado || 'activo'}</span></td>
                `;
                elements.generalMembersTable.appendChild(tr);
            });
        }

        // 5. Render Active Leaders Presence (Invisible Super Admin)
        elements.generalActiveUsers.innerHTML = '';
        const leaders = users.filter(u => u.email !== 'admin@dynamis.com');
        
        leaders.forEach(u => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.padding = '8px 12px';
            li.style.background = 'hsla(240, 10%, 15%, 0.6)';
            li.style.border = '1px solid var(--border-color)';
            li.style.borderRadius = 'var(--border-radius-sm)';
            li.style.gap = '10px';
            
            const isOnline = u.conectado === true;
            const statusDot = isOnline 
                ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 6px var(--color-success); display: inline-block;"></span>`
                : `<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-text-muted); display: inline-block;"></span>`;
            
            const statusText = isOnline 
                ? `<span style="color: var(--color-success); font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">En línea</span>`
                : `<span style="color: var(--color-text-muted); font-size: 0.75rem;">Desconectado</span>`;

            const connectionInfo = isOnline 
                ? `<span style="font-size: 0.75rem; color: var(--color-text-muted)">Activo: ${u.ultimaConexion || 'Reciente'}</span>`
                : `<span style="font-size: 0.75rem; color: var(--color-text-muted)">Últ: ${u.ultimaConexion || '--'}</span>`;

            li.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px; flex-grow:1;">
                    <strong style="font-size:0.88rem; color:#fff;">${u.liderName}</strong>
                    <span style="font-size:0.75rem; color:var(--color-text-secondary);">${getRoleName(u.rol)} • ${u.nombreGrupo}</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${statusDot}
                        ${statusText}
                    </div>
                    ${connectionInfo}
                </div>
            `;
            elements.generalActiveUsers.appendChild(li);
        });

    } catch (err) {
        showToast('Error al cargar datos del dashboard: ' + err.message, 'error');
    }
}

async function handleAddTheme(e) {
    e.preventDefault();
    const title = document.getElementById('theme-title').value;
    const desc = document.getElementById('theme-desc').value;

    try {
        const newTheme = {
            titulo: title,
            descripcion: desc,
            creadoPor: currentUser.liderName,
            fecha: new Date().toISOString().split('T')[0]
        };

        await db.addDoc('themes', newTheme);
        showToast('Tema oficial publicado exitosamente', 'success');
        elements.generalThemeForm.reset();
        loadGeneralDashboard();
    } catch (err) {
        showToast('Error al crear tema: ' + err.message, 'error');
    }
}

async function handleAddDoc(e) {
    e.preventDefault();
    const title = document.getElementById('doc-title').value;
    const fileInput = elements.docFileInput;

    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Por favor seleccione un archivo para subir', 'error');
        return;
    }

    try {
        const newDoc = {
            titulo: title + " (" + fileInput.files[0].name + ")",
            urlSimulada: "#", // Mock download link
            fechaSubida: new Date().toISOString().split('T')[0]
        };

        await db.addDoc('documents', newDoc);
        showToast('Documento compartido con éxito', 'success');
        elements.generalDocForm.reset();
        elements.fileNameChosen.textContent = 'Ningún archivo seleccionado';
        elements.fileNameChosen.style.color = 'var(--color-text-muted)';
        loadGeneralDashboard();
    } catch (err) {
        showToast('Error al subir material: ' + err.message, 'error');
    }
}

// ========================================================
// DASHBOARD LOGIC - GROUP LEADER (Líder de Grupo)
// ========================================================
async function loadGroupDashboard() {
    if (!currentUser) return;
    
    elements.groupTitle.textContent = `Líder de Grupo: ${currentUser.nombreGrupo}`;
    elements.groupWelcome.textContent = `Supervisor: ${currentUser.liderName}`;

    try {
        // Query users, members, meetings
        const allUsers = await db.getCollection('users');
        const allMembers = await db.getCollection('members');
        const allMeetings = await db.getCollection('meetings');

        // Filter Area Leaders assigned to this group leader
        // For simplicity: any area leader whose group ID equals this group leader's uid
        const areaLeaders = allUsers.filter(u => u.rol === 'area' && u.grupoId === currentUser.uid);
        const areaLeaderIds = areaLeaders.map(al => al.uid);

        // Filter group meetings
        const groupMeetings = allMeetings.filter(meet => areaLeaderIds.includes(meet.areaLiderId) || meet.nombreGrupo.includes(currentUser.nombreGrupo.replace("Dynamis ", "")));
        
        // Filter group members
        const groupMembers = allMembers.filter(mem => areaLeaderIds.includes(mem.areaLiderId));

        // Render Area Leaders Table
        elements.groupAreasTable.innerHTML = '';
        if (areaLeaders.length === 0) {
            elements.groupAreasTable.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--color-text-muted)">No hay áreas asignadas bajo su cargo.</td></tr>`;
        } else {
            areaLeaders.forEach(leader => {
                const leaderMembers = allMembers.filter(m => m.areaLiderId === leader.uid);
                
                const isOnline = leader.conectado === true;
                const statusIndicator = isOnline
                    ? `<span style="display:inline-flex; align-items:center; gap:6px; color:var(--color-success); font-weight:600; font-size:0.8rem;"><span style="width:6px; height:6px; background:var(--color-success); border-radius:50%; box-shadow:0 0 6px var(--color-success);"></span> En línea</span>`
                    : `<span style="display:inline-flex; align-items:center; gap:6px; color:var(--color-text-muted); font-size:0.8rem;"><span style="width:6px; height:6px; background:var(--color-text-muted); border-radius:50%;"></span> Desconectado</span>`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${leader.liderName}</strong><br><span style="font-size:0.8rem;color:var(--color-text-muted)">${leader.nombreGrupo}</span></td>
                    <td>${leader.email}</td>
                    <td>${leader.telefono}</td>
                    <td><span class="profile-badge">${leader.distrito}</span><br><span style="font-size:0.8rem;color:var(--color-text-secondary)">${leader.direccionReunion}</span></td>
                    <td>${statusIndicator}<br><span style="font-size:0.82rem;color:var(--color-text-secondary);"><strong style="color:var(--color-cyan);font-size:1rem">${leaderMembers.length}</strong> integrantes</span></td>
                `;
                elements.groupAreasTable.appendChild(tr);
            });
        }

        // Render Compact Meetings List
        elements.groupMeetingsCompact.innerHTML = '';
        if (groupMeetings.length === 0) {
            elements.groupMeetingsCompact.innerHTML = `<div style="padding:20px;text-align:center;color:var(--color-text-muted);font-size:0.9rem">No hay registros de reuniones en sus áreas.</div>`;
        } else {
            groupMeetings.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
            
            groupMeetings.slice(0, 5).forEach(meet => {
                const div = document.createElement('div');
                div.className = 'meeting-compact-item';
                div.innerHTML = `
                    <h4>${meet.tema}</h4>
                    <div class="meeting-compact-meta">
                        <span>Lugar: ${meet.direccion} (${meet.distrito})</span><br>
                        <span>Fecha: ${meet.fecha} a las ${meet.hora}</span>
                    </div>
                    <span class="meeting-compact-count">${meet.miembrosReunidosCount} Participantes</span>
                `;
                elements.groupMeetingsCompact.appendChild(div);
            });
        }

    } catch (err) {
        showToast('Error al cargar datos de grupo: ' + err.message, 'error');
    }
}

// ========================================================
// DASHBOARD LOGIC - AREA LEADER (Líder de Área)
// ========================================================
async function loadAreaDashboard() {
    if (!currentUser) return;

    elements.areaTitle.textContent = `Líder de Área: ${currentUser.nombreGrupo}`;
    elements.areaWelcome.textContent = `Gestión a cargo de: ${currentUser.liderName} • Distrito: ${currentUser.distrito}`;

    try {
        // Load data from DB
        const allMembers = await db.getCollection('members');
        const allMeetings = await db.getCollection('meetings');
        const themes = await db.getCollection('themes');
        const docs = await db.getCollection('documents');

        // Filter local data
        // For local simulation, the preloaded uid of area leader is 'area-surco-a'
        // If user registered, it uses their unique uid.
        const myMembers = allMembers.filter(m => m.areaLiderId === currentUser.uid || (currentUser.uid.startsWith('usr-') && m.areaLiderId === currentUser.uid));
        const myMeetings = allMeetings.filter(meet => meet.areaLiderId === currentUser.uid);

        // 1. Populate Themes Selector
        elements.meetThemeSelect.innerHTML = `<option value="" disabled selected>Selecciona el tema oficial</option>`;
        if (themes.length === 0) {
            elements.meetThemeSelect.innerHTML += `<option value="Tema Libre">Tema Libre (General no ha definido)</option>`;
        } else {
            themes.forEach(theme => {
                const opt = document.createElement('option');
                opt.value = theme.titulo;
                opt.textContent = theme.titulo;
                elements.meetThemeSelect.appendChild(opt);
            });
        }

        // Set default values for meeting form address
        const locationInput = document.getElementById('meet-location');
        if (locationInput && !locationInput.value) {
            locationInput.value = currentUser.direccionReunion;
        }

        // 2. Render Members list
        elements.areaMembersList.innerHTML = '';
        if (myMembers.length === 0) {
            elements.areaMembersList.innerHTML = `<li style="padding:20px;text-align:center;color:var(--color-text-muted);font-size:0.9rem">No tienes participantes registrados en tu área.</li>`;
        } else {
            myMembers.forEach(mem => {
                const li = document.createElement('li');
                li.className = 'member-item';
                li.innerHTML = `
                    <div class="member-info">
                        <span class="member-name">${mem.nombreCompleto}</span>
                        <span class="member-phone-email">${mem.telefono} • ${mem.correo || 'Sin correo'} • <span class="profile-badge" style="font-size:0.75rem;padding:2px 6px;">${mem.distrito || currentUser.distrito}</span></span>
                    </div>
                    <button class="btn-delete-member" data-id="${mem.id}" aria-label="Eliminar participante">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                `;

                // Delete member listener
                li.querySelector('.btn-delete-member').addEventListener('click', async (e) => {
                    const memberId = e.currentTarget.getAttribute('data-id');
                    if (confirm(`¿Eliminar a ${mem.nombreCompleto} del área?`)) {
                        await db.deleteDoc('members', memberId);
                        showToast('Participante eliminado', 'info');
                        loadAreaDashboard();
                    }
                });

                elements.areaMembersList.appendChild(li);
            });
        }

        // 3. Render Meetings list
        elements.areaMeetingsScheduled.innerHTML = '';
        if (myMeetings.length === 0) {
            elements.areaMeetingsScheduled.innerHTML = `<div style="padding:20px;text-align:center;color:var(--color-text-muted);font-size:0.9rem">No tienes reuniones programadas.</div>`;
        } else {
            // Sort by date desc
            myMeetings.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

            myMeetings.forEach(meet => {
                const div = document.createElement('div');
                div.className = 'meeting-schedule-item';
                
                // Formulate whatsapp message text
                const waMessage = `¡Hola! Te informo de la próxima reunión de nuestro grupo *${currentUser.nombreGrupo}*.

*Tema:* ${meet.tema}
*Fecha:* ${meet.fecha}
*Hora:* ${meet.hora}
*Lugar:* ${meet.direccion} (${currentUser.distrito})

¡Te esperamos!`;
                
                const waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;

                div.innerHTML = `
                    <div class="meeting-meta">
                        <strong>${meet.tema}</strong>
                        <span>📍 ${meet.direccion}</span>
                        <span>📅 ${meet.fecha} a las ${meet.hora}</span>
                        <span style="color:var(--color-cyan)">👥 Conteo: ${meet.miembrosReunidosCount} participantes reunidos</span>
                    </div>
                    <div class="meeting-actions-row">
                        <a href="${waLink}" target="_blank" class="whatsapp-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.249 8.477 3.522 2.26 2.27 3.502 5.287 3.5 8.497-.005 6.66-5.345 11.997-11.956 11.997-2.005-.001-3.973-.5-5.787-1.45L0 24zm6.275-3.565l.34.202c1.6.953 3.445 1.455 5.337 1.456 5.568 0 10.101-4.52 10.106-10.088.002-2.697-1.043-5.234-2.946-7.14C17.26 3.056 14.73 2.01 12.015 2.01 6.446 2.01 1.913 6.53 1.908 12.099c-.001 1.802.476 3.566 1.383 5.114l.223.38-1.01 3.69 3.79-.993zM16.518 13.9c-.3-.15-1.782-.88-2.062-.98-.28-.1-.48-.15-.68.15-.2.3-.77.98-.95 1.18-.18.2-.35.22-.65.07-1.13-.56-1.98-.98-2.75-2.31-.2-.35-.2-.75-.35-1.1.07-.12.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.64-.93-2.24-.25-.6-.52-.52-.68-.53-.15-.01-.33-.01-.51-.01-.18 0-.47.07-.72.33-.25.27-.95.93-.95 2.28 0 1.34.98 2.64 1.12 2.82.14.18 1.92 2.93 4.66 4.12.65.28 1.16.45 1.56.57.66.21 1.25.18 1.73.11.53-.08 1.782-.73 2.032-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.21-.58-.36z"/></svg>
                            Avisar participantes
                        </a>
                        <button class="reunir-btn" data-id="${meet.id}">Registrar Asistencia</button>
                    </div>
                `;

                // Register Attendance button listener
                div.querySelector('.reunir-btn').addEventListener('click', async (e) => {
                    const meetId = e.target.getAttribute('data-id');
                    const count = prompt('Ingresa el conteo final de participantes que asistieron a la reunión:', meet.miembrosReunidosCount);
                    
                    if (count !== null) {
                        const num = parseInt(count);
                        if (isNaN(num) || num < 0) {
                            showToast('Por favor ingresa un número válido', 'error');
                            return;
                        }

                        await db.updateDoc('meetings', meetId, { miembrosReunidosCount: num });
                        showToast('Asistencia actualizada con éxito', 'success');
                        loadAreaDashboard();
                    }
                });

                elements.areaMeetingsScheduled.appendChild(div);
            });
        }

        // 4. Render Downloadable Materials
        elements.areaDownloadableDocs.innerHTML = '';
        if (docs.length === 0) {
            elements.areaDownloadableDocs.innerHTML = `<li style="padding:10px;text-align:center;color:var(--color-text-muted);font-size:0.85rem">No hay material de apoyo compartido por el Líder General.</li>`;
        } else {
            docs.forEach(doc => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="doc-title-wrapper">
                        <svg class="doc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        <span style="font-weight:500">${doc.titulo}</span>
                    </div>
                    <button class="btn-download" data-filename="${doc.titulo}">Descargar</button>
                `;

                // Download listener
                li.querySelector('.btn-download').addEventListener('click', (e) => {
                    const filename = e.target.getAttribute('data-filename');
                    showToast(`Descargando recurso: ${filename}...`, 'info');
                    
                    // Simple simulation
                    setTimeout(() => {
                        showToast(`¡Descarga de "${filename}" completada!`, 'success');
                    }, 1500);
                });

                elements.areaDownloadableDocs.appendChild(li);
            });
        }

    } catch (err) {
        showToast('Error al cargar datos del área: ' + err.message, 'error');
    }
}

async function handleAddMember(e) {
    e.preventDefault();
    const name = document.getElementById('member-name').value;
    const email = document.getElementById('member-email').value;
    const phone = document.getElementById('member-phone').value;

    try {
        const newMember = {
            areaLiderId: currentUser.uid,
            nombreCompleto: name,
            correo: email || '',
            telefono: phone,
            distrito: currentUser.distrito,
            estado: 'activo'
        };

        await db.addDoc('members', newMember);
        showToast('Participante agregado al área exitosamente', 'success');
        elements.areaMemberForm.reset();
        loadAreaDashboard();
    } catch (err) {
        showToast('Error al agregar participante: ' + err.message, 'error');
    }
}

async function handleCreateMeeting(e) {
    e.preventDefault();
    const theme = document.getElementById('meet-theme').value;
    const date = document.getElementById('meet-date').value;
    const time = document.getElementById('meet-time').value;
    const location = document.getElementById('meet-location').value;
    const expectedCount = document.getElementById('meet-expected-count').value;

    try {
        const newMeeting = {
            areaLiderId: currentUser.uid,
            nombreGrupo: currentUser.nombreGrupo,
            distrito: currentUser.distrito,
            direccion: location,
            fecha: date,
            hora: time,
            tema: theme,
            miembrosReunidosCount: parseInt(expectedCount) || 0
        };

        await db.addDoc('meetings', newMeeting);
        showToast('¡Reunión programada con éxito!', 'success');
        elements.areaMeetingForm.reset();
        // Keep the address populated for ease of use
        document.getElementById('meet-location').value = currentUser.direccionReunion;
        
        loadAreaDashboard();
    } catch (err) {
        showToast('Error al programar la reunión: ' + err.message, 'error');
    }
}
