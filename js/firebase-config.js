// Dynamis Firebase Config & Offline Fallback Database System

// Initial Mock Data to populate the database on first load
const INITIAL_MOCK_DATA = {
    users: [
        {
            uid: "super-admin",
            email: "admin@dynamis.com",
            password: "AdminCDF26",
            nombreGrupo: "Super Administración",
            liderName: "Super Administrador",
            direccionReunion: "Sede Central",
            telefono: "999999999",
            distrito: "Miraflores",
            rol: "admin"
        },
        {
            uid: "gen-supremo",
            email: "general@dynamis.com",
            password: "general123",
            nombreGrupo: "Directorio General",
            liderName: "Líder General Supremo",
            direccionReunion: "Sede Central Miraflores",
            telefono: "999888777",
            distrito: "Miraflores",
            rol: "general"
        },
        {
            uid: "grupo-surco",
            email: "grupo@dynamis.com",
            password: "grupo123",
            nombreGrupo: "Dynamis Surco",
            liderName: "Marcos Aurelio",
            direccionReunion: "Av. Primavera 1230",
            telefono: "988777666",
            distrito: "Santiago de Surco",
            rol: "grupo"
        },
        {
            uid: "area-surco-a",
            email: "area@dynamis.com",
            password: "area123",
            nombreGrupo: "Dynamis Surco A",
            liderName: "Sofía Ruiz",
            direccionReunion: "Calle Las Flores 450",
            telefono: "977666555",
            distrito: "Santiago de Surco",
            rol: "area",
            grupoId: "grupo-surco"
        }
    ],
    members: [],
    themes: [],
    documents: [],
    meetings: []
};

// Check if localStorage has database, otherwise initialize
let localDbStored = localStorage.getItem("dynamis_local_db");
if (!localDbStored) {
    localStorage.setItem("dynamis_local_db", JSON.stringify(INITIAL_MOCK_DATA));
} else {
    // Purge old simulation/mock data if present, keeping only user accounts
    try {
        let dbParsed = JSON.parse(localDbStored);
        const hasSimulatedData = (dbParsed.members && dbParsed.members.some(m => m.id === "mem-1")) || 
                                 (dbParsed.documents && dbParsed.documents.some(d => d.id === "doc-1")) ||
                                 (dbParsed.themes && dbParsed.themes.some(t => t.id === "theme-1"));
        if (hasSimulatedData) {
            dbParsed.members = [];
            dbParsed.themes = [];
            dbParsed.documents = [];
            dbParsed.meetings = [];
            localStorage.setItem("dynamis_local_db", JSON.stringify(dbParsed));
        }
    } catch(err) {
        console.error("Migration error:", err);
    }
    // Self-healing migration to make sure area-surco-a has grupoId and admin is injected
    try {
        let dbParsed = JSON.parse(localDbStored);
        
        // 1. Check Sofía Ruiz group mapping
        let areaUser = dbParsed.users?.find(u => u.uid === "area-surco-a");
        if (areaUser && !areaUser.grupoId) {
            areaUser.grupoId = "grupo-surco";
        }
        
        // 2. Check admin user existence
        let adminUser = dbParsed.users?.find(u => u.email === "admin@dynamis.com");
        if (!adminUser) {
            if (!dbParsed.users) dbParsed.users = [];
            dbParsed.users.push({
                uid: "super-admin",
                email: "admin@dynamis.com",
                password: "AdminCDF26",
                nombreGrupo: "Super Administración",
                liderName: "Super Administrador",
                direccionReunion: "Sede Central",
                telefono: "999999999",
                distrito: "Miraflores",
                rol: "admin"
            });
        }
        
        localStorage.setItem("dynamis_local_db", JSON.stringify(dbParsed));
    } catch(e) {
        localStorage.setItem("dynamis_local_db", JSON.stringify(INITIAL_MOCK_DATA));
    }
}

// ----------------------------------------------------
// Mock Database Client (Simulates Firestore Interface)
// ----------------------------------------------------
class LocalDB {
    constructor() {
        this.dbKey = "dynamis_local_db";
    }

    _getData() {
        return JSON.parse(localStorage.getItem(this.dbKey));
    }

    _saveData(data) {
        localStorage.setItem(this.dbKey, JSON.stringify(data));
        // Trigger storage event manually for same-window updates
        window.dispatchEvent(new Event("storage"));
    }

    // SIMULATED FIRESTORE METHODS
    async getCollection(collName, queryFn = null) {
        const data = this._getData();
        let items = data[collName] || [];
        if (queryFn) {
            items = items.filter(queryFn);
        }
        return items;
    }

    async addDoc(collName, docData) {
        const data = this._getData();
        if (!data[collName]) data[collName] = [];
        const newDoc = {
            id: docData.id || `${collName.substring(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ...docData
        };
        data[collName].push(newDoc);
        this._saveData(data);
        return newDoc;
    }

    async updateDoc(collName, docId, updateData) {
        const data = this._getData();
        const index = data[collName]?.findIndex(item => item.id === docId || item.uid === docId);
        if (index !== -1 && index !== undefined) {
            data[collName][index] = { ...data[collName][index], ...updateData };
            this._saveData(data);
            return data[collName][index];
        }
        throw new Error(`Documento con ID ${docId} no encontrado en ${collName}`);
    }

    async deleteDoc(collName, docId) {
        const data = this._getData();
        const index = data[collName]?.findIndex(item => item.id === docId || item.uid === docId);
        if (index !== -1 && index !== undefined) {
            data[collName].splice(index, 1);
            this._saveData(data);
            return true;
        }
        return false;
    }

    // Auth simulation helper
    async authenticate(email, password) {
        const users = await this.getCollection("users");
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        return user || null;
    }
}

// ----------------------------------------------------
// Real Firebase Initialization Setup
// ----------------------------------------------------
let firebaseApp = null;
let firestoreDb = null;
let isRealFirebase = false;

// Attempt to load Firebase config from localStorage (for user configuration)
const savedFirebaseConfig = localStorage.getItem("dynamis_firebase_config");

if (savedFirebaseConfig) {
    try {
        const config = JSON.parse(savedFirebaseConfig);
        
        // Dynamic ESM imports for Firebase from CDNs
        const { initializeApp } = await import("firebase/app");
        const { getFirestore } = await import("firebase/firestore");

        firebaseApp = initializeApp(config);
        firestoreDb = getFirestore(firebaseApp);
        isRealFirebase = true;
        console.log("Firebase initialized successfully with saved configuration.");
    } catch (e) {
        console.error("Failed to initialize saved Firebase configuration, falling back to Local Storage DB.", e);
    }
}

// Export database wrapper
const localDbInstance = new LocalDB();

export const db = {
    // General flag
    isFirebase: isRealFirebase,

    // Get collection items
    async getCollection(collName, queryFn = null) {
        if (isRealFirebase && firestoreDb) {
            try {
                const { collection, getDocs, query } = await import("firebase/firestore");
                const colRef = collection(firestoreDb, collName);
                const querySnapshot = await getDocs(colRef);
                const items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                
                // If filter is provided
                if (queryFn) {
                    return items.filter(queryFn);
                }
                return items;
            } catch (e) {
                console.error(`Firebase error reading ${collName}, falling back to LocalStorage`, e);
                return localDbInstance.getCollection(collName, queryFn);
            }
        } else {
            return localDbInstance.getCollection(collName, queryFn);
        }
    },

    // Add document
    async addDoc(collName, docData) {
        if (isRealFirebase && firestoreDb) {
            try {
                const { collection, addDoc } = await import("firebase/firestore");
                const colRef = collection(firestoreDb, collName);
                const docRef = await addDoc(colRef, docData);
                // Sync to local DB as cache
                await localDbInstance.addDoc(collName, { id: docRef.id, ...docData });
                return { id: docRef.id, ...docData };
            } catch (e) {
                console.error(`Firebase error adding doc to ${collName}, falling back to LocalStorage`, e);
                return localDbInstance.addDoc(collName, docData);
            }
        } else {
            return localDbInstance.addDoc(collName, docData);
        }
    },

    // Update document
    async updateDoc(collName, docId, updateData) {
        if (isRealFirebase && firestoreDb) {
            try {
                const { doc, updateDoc } = await import("firebase/firestore");
                const docRef = doc(firestoreDb, collName, docId);
                await updateDoc(docRef, updateData);
                // Sync to local DB
                await localDbInstance.updateDoc(collName, docId, updateData);
                return { id: docId, ...updateData };
            } catch (e) {
                console.error(`Firebase error updating ${docId} in ${collName}, falling back to LocalStorage`, e);
                return localDbInstance.updateDoc(collName, docId, updateData);
            }
        } else {
            return localDbInstance.updateDoc(collName, docId, updateData);
        }
    },

    // Delete document
    async deleteDoc(collName, docId) {
        if (isRealFirebase && firestoreDb) {
            try {
                const { doc, deleteDoc } = await import("firebase/firestore");
                const docRef = doc(firestoreDb, collName, docId);
                await deleteDoc(docRef);
                // Sync to local DB
                await localDbInstance.deleteDoc(collName, docId);
                return true;
            } catch (e) {
                console.error(`Firebase error deleting ${docId} in ${collName}, falling back to LocalStorage`, e);
                return localDbInstance.deleteDoc(collName, docId);
            }
        } else {
            return localDbInstance.deleteDoc(collName, docId);
        }
    },

    // Authentication helper
    async login(email, password) {
        // We simulate a robust authentication system using users collection
        const user = await localDbInstance.authenticate(email, password);
        return user;
    },

    // Config options
    saveFirebaseConfig(config) {
        localStorage.setItem("dynamis_firebase_config", JSON.stringify(config));
    },

    clearFirebaseConfig() {
        localStorage.removeItem("dynamis_firebase_config");
    }
};

window.DynamisDb = db; // Make global for debugging
