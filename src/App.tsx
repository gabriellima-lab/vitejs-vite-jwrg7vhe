import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, query
} from 'firebase/firestore';
import { 
  Package, Plus, Search, Edit2, Trash2, Camera, X, Save, HardHat, Wrench, Truck, Image as ImageIcon, WifiOff, CloudOff, 
  Download, LayoutGrid, List, AlertTriangle, Minus, MapPin, Settings, LogOut, Lock, User as UserIcon
} from 'lucide-react';

// ==========================================
// CHAVES DO FIREBASE DA SEEL ENGENHARIA
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDeAF5R3AI_JxHN-uCv0dAoaDb0nx5mDw8",
  authDomain: "estoque-seel.firebaseapp.com",
  projectId: "estoque-seel",
  storageBucket: "estoque-seel.firebasestorage.app",
  messagingSenderId: "980150254173",
  appId: "1:980150254173:web:27e02e65c557a3e2976bb4",
  measurementId: "G-Y2K2EH47PX"
};

// Inicialização Segura do Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'estoque-seel'; 

// Categorias e Unidades
const CATEGORIAS = ['Materiais', 'EPI', 'Ferramentas', 'Equipamentos', 'Outros'];
const UNIDADES = ['un', 'kg', 'm', 'm²', 'm³', 'litros', 'cx', 'pct'];
const STATUS = ['Disponível', 'Em uso', 'Quebrado/Defeito', 'Falta'];

// Cores da Marca SEEL
const COLORS = { blue: '#16507A', yellow: '#FCE116' };

// Função para comprimir imagem
const processImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event?.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800, MAX_HEIGHT = 800;
        let width = img.width, height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  const [user, setUser] = useState<any>(null); 
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterLocation, setFilterLocation] = useState('Todos'); 
  
  const [view, setView] = useState('list'); 
  const [displayMode, setDisplayMode] = useState('grid'); 
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const [isLocationManagerOpen, setIsLocationManagerOpen] = useState(false);

  // Monitorização de Internet
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitorização do Utilizador
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Busca de Dados
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    
    const inventoryRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'inventory');
    const q = query(inventoryRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data()
      }));
      fetchedItems.sort((a, b) => a.nome.localeCompare(b.nome));
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar dados:", error);
      alert("A sua conta ainda não tem permissão para ler o estoque. Verifique as regras do banco de dados.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (currentItem) {
      const updatedItem = items.find(i => i.id === currentItem.id);
      if (updatedItem && updatedItem.quantidade !== currentItem.quantidade) {
        setCurrentItem(updatedItem);
      }
    }
  }, [items]);

  const uniqueLocations = useMemo(() => {
    const locs = items.map(item => item.localizacao).filter(loc => loc && loc.trim() !== '');
    return [...new Set(locs)].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (item.localizacao && item.localizacao.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === 'Todas' || item.categoria === filterCategory;
      const matchesLocation = filterLocation === 'Todos' || item.localizacao === filterLocation;
      
      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [items, searchTerm, filterCategory, filterLocation]);

  const exportToExcel = () => {
    const headers = ['NOME,CATEGORIA,QUANTIDADE,UNIDADE,ESTOQUE MINIMO,STATUS,ALMOXARIFADO,OBSERVACOES\n'];
    const rows = items.map(item => {
      const obs = item.observacoes ? item.observacoes.replace(/(\r\n|\n|\r)/gm, " ") : "";
      return `"${item.nome}","${item.categoria}",${item.quantidade},"${item.unidade}",${item.estoqueMinimo || 0},"${item.status}","${item.localizacao}","${obs}"`;
    });
    
    const csvContent = "\uFEFF" + headers + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Estoque_SEEL_${user?.email?.split('@')[0]}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    link.click();
  };

  const handleSaveItem = async (formData: any) => {
    if (!user) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }
    try {
      const inventoryRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'inventory');
      const payload = { ...formData, atualizadoPor: user.uid, ultimaAtualizacao: serverTimestamp() };

      if (currentItem && currentItem.id) {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'inventory', currentItem.id);
        await updateDoc(docRef, payload);
      } else {
        payload.criadoEm = serverTimestamp();
        await addDoc(inventoryRef, payload);
      }
      setView('list'); 
      setCurrentItem(null);
    } catch (error: any) { 
      console.error("Erro ao salvar:", error);
      alert("ERRO AO SALVAR: O Firebase bloqueou a gravação. Verifique as Regras de Utilizador.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!user || !window.confirm('Tem certeza que deseja excluir este item permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'inventory', id));
      if (currentItem && currentItem.id === id) setView('list');
    } catch (error) { 
      alert("Erro ao excluir.");
    }
  };

  const handleQuickUpdate = async (e: any, item: any, change: number) => {
    e.stopPropagation(); 
    if (!user) return;
    
    const newQuantity = Math.max(0, Number(item.quantidade) + change);
    if (currentItem && currentItem.id === item.id) {
      setCurrentItem({ ...currentItem, quantidade: newQuantity });
    }

    try {
      const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'inventory', item.id);
      await updateDoc(docRef, {
        quantidade: newQuantity,
        atualizadoPor: user.uid,
        ultimaAtualizacao: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro:", error);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'EPI': return <HardHat className="w-6 h-6 text-yellow-600" />;
      case 'Ferramentas': return <Wrench className="w-6 h-6 text-gray-600" />;
      case 'Equipamentos': return <Truck className="w-6 h-6 text-blue-600" />;
      default: return <Package className="w-6 h-6 text-orange-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Disponível': return 'bg-green-100 text-green-800 border-green-200';
      case 'Em uso': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Falta': return 'bg-red-100 text-red-800 border-red-200';
      case 'Quebrado/Defeito': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 mb-4" style={{ borderColor: COLORS.blue }}></div>
        <p className="text-slate-500 font-bold animate-pulse">Acedendo ao sistema...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen colors={COLORS} auth={auth} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {isOffline && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-bold shadow-md z-50 relative">
          <WifiOff className="w-4 h-4" /> Sem ligação à internet.
        </div>
      )}

      {/* HEADER ATUALIZADO COM A IMAGEM DA LOGO E NOME */}
      <header className="shadow-lg sticky top-0 z-10 border-b-4 border-black/20 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 select-none cursor-pointer" onClick={() => { setView('list'); setCurrentItem(null); }}>
            <img src="/9490.png" alt="SEEL" className="h-10 sm:h-12 w-auto object-contain" />
            <div className="flex flex-col border-l-2 border-slate-300 pl-3">
              <span className="font-black text-sm sm:text-base tracking-wider uppercase text-slate-800 leading-tight">Controle de Estoque</span>
              <span className="text-[0.55rem] sm:text-[0.65rem] font-bold text-slate-500 tracking-widest">SERVIÇOS ESPECIAIS DE ENGENHARIA</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs text-slate-600 hidden sm:block mr-2 font-medium truncate max-w-[150px]">{user?.email}</span>
            {view === 'list' && (
              <button onClick={exportToExcel} className="text-slate-700 hover:text-blue-700 p-2 rounded-full hover:bg-slate-100 transition-colors" title="Exportar Planilha Excel">
                <Download className="w-6 h-6" />
              </button>
            )}
            {view !== 'list' ? (
              <button onClick={() => { setView('list'); setCurrentItem(null); }} className="text-slate-700 hover:text-slate-900 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-7 h-7" />
              </button>
            ) : (
              <button onClick={() => signOut(auth)} className="text-slate-700 hover:text-red-600 p-2 rounded-full hover:bg-slate-100 transition-colors" title="Sair da Conta">
                <LogOut className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading && view === 'list' ? (
           <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-4" style={{ borderColor: COLORS.blue }}></div></div>
        ) : view === 'list' && (
          <div className="space-y-6 animate-fade-in">
            
            <div className="flex flex-col bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center w-full">
                <div className="relative w-full md:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input type="text" placeholder="Pesquisar material..." className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-700 transition-colors text-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="relative w-full md:w-80 flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <select 
                      value={filterLocation} 
                      onChange={(e) => setFilterLocation(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-700 bg-white appearance-none cursor-pointer font-medium text-lg"
                    >
                      <option value="Todos">Todos os Locais</option>
                      {uniqueLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => setIsLocationManagerOpen(true)} className="p-3 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors" title="Gerenciar Locais da Obra">
                    <Settings className="w-6 h-6 text-slate-600" />
                  </button>
                </div>
                
                <div className="flex bg-slate-100 p-1.5 rounded-xl shrink-0">
                  <button onClick={() => setDisplayMode('grid')} className={`p-2.5 rounded-lg ${displayMode === 'grid' ? 'bg-white shadow text-blue-900' : 'text-slate-500'}`} title="Ver em Miniaturas"><LayoutGrid className="w-6 h-6" /></button>
                  <button onClick={() => setDisplayMode('list_view')} className={`p-2.5 rounded-lg ${displayMode === 'list_view' ? 'bg-white shadow text-blue-900' : 'text-slate-500'}`} title="Ver em Lista"><List className="w-6 h-6" /></button>
                </div>
              </div>

              <div className="flex gap-2 w-full overflow-x-auto pb-2 custom-scrollbar">
                {['Todas', ...CATEGORIAS].map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setFilterCategory(cat)} 
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border ${filterCategory === cat ? 'text-white border-transparent shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`} 
                    style={filterCategory === cat ? { backgroundColor: COLORS.blue } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${displayMode === 'grid' ? 'bg-transparent border-none shadow-none' : 'p-2'}`}>
              {filteredItems.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Package className="w-20 h-20 mb-4 text-slate-300" />
                  <p className="text-xl font-bold">Nenhum item encontrado.</p>
                  <p className="text-slate-500 mt-2">Clique no botão + para adicionar ao seu estoque.</p>
                </div>
              ) : (
                <div className={displayMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" : "flex flex-col gap-3"}>
                  {filteredItems.map(item => {
                    const isLowStock = Number(item.quantidade) <= Number(item.estoqueMinimo || 0);

                    if (displayMode === 'grid') {
                      return (
                        <div 
                          key={item.id} 
                          className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer relative flex flex-col h-full transform hover:-translate-y-1"
                          onClick={() => { setCurrentItem(item); setView('details'); }}
                        >
                          {isLowStock && <div className="absolute top-2 right-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md animate-pulse">BAIXO</div>}
                          
                          <div className="w-full h-48 sm:h-56 bg-slate-100 flex items-center justify-center relative border-b border-slate-100">
                            {item.foto ? (
                               <img src={item.foto} alt={item.nome} className="w-full h-full object-cover" />
                            ) : (
                               <ImageIcon className="w-16 h-16 text-slate-300" />
                            )}
                            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm">
                               {getCategoryIcon(item.categoria)}
                            </div>
                          </div>
                          
                          <div className="p-5 flex flex-col flex-1">
                            <h3 className="font-black text-xl text-slate-800 line-clamp-2 leading-tight mb-2" title={item.nome}>{item.nome}</h3>
                            <div className="flex items-center gap-1 text-sm font-semibold text-slate-500 mb-4">
                               <MapPin className="w-4 h-4 text-slate-400" />
                               <span className="truncate">{item.localizacao || 'Sem local'}</span>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                               <div className="flex flex-col">
                                  <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Estoque</span>
                                  <span className={`font-black text-2xl leading-none ${isLowStock ? 'text-red-600' : 'text-[#16507A]'}`}>
                                    {item.quantidade} <span className="text-sm font-bold text-slate-500">{item.unidade}</span>
                                  </span>
                               </div>
                               
                               <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200">
                                 <button onClick={(e) => handleQuickUpdate(e, item, -1)} className="p-2 hover:text-red-600 hover:bg-slate-200 rounded-l-lg transition-colors"><Minus className="w-5 h-5" /></button>
                                 <div className="w-px h-6 bg-slate-300"></div>
                                 <button onClick={(e) => handleQuickUpdate(e, item, 1)} className="p-2 hover:text-green-600 hover:bg-slate-200 rounded-r-lg transition-colors"><Plus className="w-5 h-5" /></button>
                               </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={item.id} 
                        className="group hover:bg-slate-50 transition-colors cursor-pointer relative border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm"
                        onClick={() => { setCurrentItem(item); setView('details'); }}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="shrink-0 bg-slate-100 border overflow-hidden flex items-center justify-center w-16 h-16 rounded-xl">
                            {item.foto ? <img src={item.foto} alt={item.nome} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-300" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-slate-800 truncate leading-tight flex items-center gap-2">
                              {item.nome}
                              {isLowStock && <AlertTriangle className="w-5 h-5 text-red-500" title="Estoque Baixo!" />}
                            </h3>
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mt-1 truncate">
                               <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{item.categoria}</span>
                               <span className="truncate">📍 {item.localizacao || 'Sem local'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                           <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-1">
                             <button onClick={(e) => handleQuickUpdate(e, item, -1)} className="p-2 text-slate-600 hover:text-red-600 hover:bg-slate-200 rounded-lg transition-colors"><Minus className="w-5 h-5" /></button>
                             <div className="px-4 flex flex-col items-center min-w-[3.5rem]">
                               <span className={`font-black text-xl ${isLowStock ? 'text-red-600' : 'text-[#16507A]'}`}>{item.quantidade}</span>
                               <span className="text-[0.6rem] uppercase font-bold text-slate-500 -mt-1">{item.unidade}</span>
                             </div>
                             <button onClick={(e) => handleQuickUpdate(e, item, 1)} className="p-2 text-slate-600 hover:text-green-600 hover:bg-slate-200 rounded-lg transition-colors"><Plus className="w-5 h-5" /></button>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={() => { setCurrentItem(null); setView('form'); }} className="fixed bottom-6 right-6 w-16 h-16 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-40" style={{ backgroundColor: COLORS.blue, border: `2px solid ${COLORS.yellow}` }}>
              <Plus className="w-8 h-8" style={{ color: COLORS.yellow }} />
            </button>
          </div>
        )}

        {view === 'details' && currentItem && (
          <div className="animate-fade-in bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden max-w-3xl mx-auto">
             {currentItem.foto && <div className="w-full h-80 bg-slate-100 border-b border-slate-200"><img src={currentItem.foto} className="w-full h-full object-contain" /></div>}
             <div className="p-6 md:p-8">
               
               {Number(currentItem.quantidade) <= Number(currentItem.estoqueMinimo || 0) && (
                 <div className="bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-xl mb-6 flex items-center gap-3 font-bold text-lg shadow-sm">
                   <AlertTriangle className="w-8 h-8 text-red-600 shrink-0" />
                   Atenção: O estoque deste item atingiu o nível mínimo ({currentItem.estoqueMinimo} {currentItem.unidade})!
                 </div>
               )}

               <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-6">{currentItem.nome}</h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                 <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex justify-between items-center shadow-sm">
                   <div>
                     <p className="text-sm font-bold text-blue-800 uppercase mb-1">Qtd em Estoque</p>
                     <p className="text-5xl font-black" style={{ color: COLORS.blue }}>{currentItem.quantidade} <span className="text-2xl">{currentItem.unidade}</span></p>
                   </div>
                   <div className="flex flex-col gap-2">
                      <button onClick={(e) => handleQuickUpdate(e, currentItem, 1)} className="bg-white border border-blue-200 hover:bg-blue-600 hover:text-white p-3 rounded-xl text-blue-800 transition-colors shadow-sm"><Plus className="w-6 h-6"/></button>
                      <button onClick={(e) => handleQuickUpdate(e, currentItem, -1)} className="bg-white border border-red-200 hover:bg-red-600 hover:text-white p-3 rounded-xl text-red-800 transition-colors shadow-sm"><Minus className="w-6 h-6"/></button>
                   </div>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                   <p className="text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><MapPin className="w-4 h-4"/> Localização</p>
                   <p className="text-2xl font-bold text-slate-800">{currentItem.localizacao || 'Não especificada'}</p>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">{getCategoryIcon(currentItem.categoria)}</div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Categoria</p>
                      <p className="font-bold text-slate-800">{currentItem.categoria}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Estado</p>
                      <p className="font-bold text-slate-800">{currentItem.status}</p>
                    </div>
                  </div>
               </div>

               {currentItem.observacoes && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Observações Adicionais</h3>
                  <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-xl text-slate-700 whitespace-pre-wrap font-medium text-lg leading-relaxed">
                    {currentItem.observacoes}
                  </div>
                </div>
               )}

               <div className="flex justify-between items-center pt-8 border-t border-slate-200">
                  <button onClick={() => handleDeleteItem(currentItem.id)} className="flex items-center gap-2 text-red-600 font-bold hover:bg-red-50 px-6 py-3 rounded-xl transition-colors"><Trash2 className="w-6 h-6" /> Excluir Item</button>
                  <button onClick={() => setView('form')} className="flex items-center gap-2 text-white px-8 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all text-lg" style={{ backgroundColor: COLORS.blue }}><Edit2 className="w-5 h-5" /> Editar Cadastro</button>
               </div>
             </div>
          </div>
        )}

        {view === 'form' && (
          <ItemForm 
            item={currentItem} 
            onSave={handleSaveItem} 
            onCancel={() => setView(currentItem ? 'details' : 'list')} 
            colors={COLORS} 
            locations={uniqueLocations} 
          />
        )}
      </main>

      <LocationManagerModal 
         isOpen={isLocationManagerOpen} 
         onClose={() => setIsLocationManagerOpen(false)} 
         locations={uniqueLocations} 
         items={items} 
         db={db} 
         user={user} 
         appId={APP_ID}
      />
    </div>
  );
}

// ==========================================
// COMPONENTE: TELA DE LOGIN (SEM CRIAÇÃO DE CONTA)
// ==========================================
function AuthScreen({ colors, auth }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const emailAjustado = email.toLowerCase().trim();
    if (!emailAjustado.endsWith('@seel.com.br')) {
      setErrorMsg('Acesso restrito! Apenas e-mails corporativos (@seel.com.br) são permitidos.');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, emailAjustado, password);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorMsg('E-mail ou senha incorretos.');
      } else {
        setErrorMsg('Erro de autenticação. Contacte o administrador do sistema.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in">
        <div className="p-8 pb-6 flex flex-col items-center border-b border-slate-200 bg-white">
          <img src="/9490.png" alt="SEEL Serviços Especiais de Engenharia" className="w-full max-w-[240px] h-auto object-contain mb-6 rounded shadow-sm" />
          <h1 className="text-slate-700 font-black text-xl tracking-wide uppercase">Acesso ao Estoque</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {errorMsg && <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-bold border border-red-200 text-center flex items-center justify-center gap-2"><AlertTriangle className="w-5 h-5 shrink-0"/> {errorMsg}</div>}
          
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">Email SEEL</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-700 transition-colors font-medium text-lg" placeholder="email@seel.com.br" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-700 transition-colors font-medium text-lg" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 rounded-xl text-white font-black text-lg shadow-md hover:shadow-lg transition-all flex justify-center" style={{ backgroundColor: colors.blue }}>
            {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: GESTOR DE ALMOXARIFADOS
// ==========================================
function LocationManagerModal({ isOpen, onClose, locations, items, db, user, appId }: any) {
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  if (!isOpen) return null;

  const handleEdit = async (oldName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingLoc(null); return; }
    if (!user) return alert("Erro de permissão.");

    const itemsToUpdate = items.filter((i: any) => i.localizacao === oldName);
    try {
      const batch = writeBatch(db);
      itemsToUpdate.forEach((item: any) => {
         const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', item.id);
         batch.update(ref, { localizacao: newName.trim(), ultimaAtualizacao: serverTimestamp(), atualizadoPor: user.uid });
      });
      await batch.commit();
      setEditingLoc(null);
    } catch(e) { console.error(e); alert("Erro ao alterar o nome do local."); }
  };

  const handleDelete = async (locName: string) => {
    const count = items.filter((i: any) => i.localizacao === locName).length;
    if (!window.confirm(`Atenção: Tem certeza que deseja excluir o almoxarifado "${locName}"?\nEle será removido de ${count} item(ns) do estoque.`)) return;
    if (!window.confirm(`CUIDADO! Esta ação não pode ser desfeita.\nDeseja MESMO excluir definitivamente o local "${locName}"?`)) return;

    try {
      const batch = writeBatch(db);
      const itemsToUpdate = items.filter((i: any) => i.localizacao === locName);
      itemsToUpdate.forEach((item: any) => {
         const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', item.id);
         batch.update(ref, { localizacao: '', ultimaAtualizacao: serverTimestamp(), atualizadoPor: user.uid });
      });
      await batch.commit();
    } catch(e) { console.error(e); alert("Erro ao excluir local."); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-slate-600" />
            <h2 className="font-bold text-xl text-slate-800">Gerenciar Almoxarifados</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6 text-slate-500" /></button>
        </div>
        
        <div className="p-3 bg-blue-50 text-blue-800 text-sm text-center border-b border-blue-100 font-bold">
          As alterações afetam todos os materiais nestes locais.
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {locations.length === 0 ? (
            <div className="text-center text-slate-500 py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
               <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-3" />
               <p className="font-bold">Nenhum local cadastrado.</p>
               <p className="text-sm">Eles aparecerão aqui ao criar novos itens.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {locations.map((loc: string) => (
                <li key={loc} className="flex justify-between items-center p-4 border border-slate-200 rounded-xl hover:shadow-sm transition-all bg-white">
                  {editingLoc === loc ? (
                    <div className="flex gap-2 w-full">
                      <input value={newName} onChange={e => setNewName(e.target.value)} className="border-2 border-blue-400 p-2 rounded-lg w-full outline-none font-bold" autoFocus />
                      <button onClick={() => handleEdit(loc)} className="bg-green-600 hover:bg-green-700 text-white px-4 font-bold rounded-lg transition-colors">OK</button>
                      <button onClick={() => setEditingLoc(null)} className="bg-slate-200 hover:bg-slate-500 text-slate-700 px-4 font-bold rounded-lg transition-colors">X</button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-lg text-slate-700 truncate pr-4">{loc}</span>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setEditingLoc(loc); setNewName(loc); }} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Editar Nome"><Edit2 className="w-5 h-5"/></button>
                        <button onClick={() => handleDelete(loc)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title="Excluir Local"><Trash2 className="w-5 h-5"/></button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm">Concluir</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: FORMULÁRIO DE ITENS (CORRIGIDO ALMOXARIFADO)
// ==========================================
function ItemForm({ item, onSave, onCancel, colors, locations }: any) {
  const [formData, setFormData] = useState(item || { 
    nome: '', categoria: 'Materiais', quantidade: '', unidade: 'un', estoqueMinimo: 5, status: 'Disponível', localizacao: '', observacoes: '', foto: '' 
  });
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  
  const [isCustomLoc, setIsCustomLoc] = useState(() => {
    if (locations.length === 0) return true;
    if (item && item.localizacao && !locations.includes(item.localizacao)) return true;
    return false;
  });

  const handleChange = (e: any) => {
    const { name, value, type } = e.target;
    let newValue = value;
    if (type === 'number') newValue = value === '' ? '' : Number(value);
    setFormData((prev: any) => ({ ...prev, [name]: newValue }));
  };

  const handleImageUpload = async (e: any) => {
    if (!e.target.files[0]) return;
    setIsProcessingImg(true);
    try {
      const base64Img = await processImage(e.target.files[0]);
      setFormData((prev: any) => ({ ...prev, foto: base64Img }));
    } catch (err) { alert("Erro ao carregar imagem."); } finally { setIsProcessingImg(false); }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!formData.nome.trim()) return alert("O Nome do Item é obrigatório.");
    if (!formData.localizacao.trim()) return alert("O Almoxarifado / Localização é obrigatório.");
    
    const payload = {
      ...formData,
      quantidade: formData.quantidade === '' ? 0 : Number(formData.quantidade),
      estoqueMinimo: formData.estoqueMinimo === '' ? 0 : Number(formData.estoqueMinimo)
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl mx-auto overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-200 bg-slate-50"><h2 className="text-3xl font-black text-slate-800">{item ? 'Editar Cadastro' : 'Novo Material'}</h2></div>
      <div className="p-8 space-y-8">
        
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-40 h-40 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden relative bg-slate-50 shrink-0">
             {formData.foto ? <><img src={formData.foto} className="w-full h-full object-cover" /><button type="button" onClick={() => setFormData((prev: any) => ({...prev, foto:''}))} className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-full p-2 shadow-md hover:text-red-700 transition-colors"><X className="w-5 h-5 text-red-500"/></button></> : <Camera className="w-12 h-12 text-slate-300" />}
          </div>
          <div className="flex-1 flex flex-col justify-center">
             <label className="cursor-pointer bg-white border-2 border-slate-200 px-6 py-4 rounded-xl font-bold inline-flex items-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-colors self-start shadow-sm text-lg"><Camera className="w-6 h-6 text-slate-600" /> Tirar Foto do Material <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/></label>
             <p className="text-sm font-medium text-slate-500 mt-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Otimizado automaticamente para poupar dados.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Nome do Item *</label><input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 transition-colors text-lg font-bold text-slate-800" placeholder="Ex: Cimento CP II..." /></div>
          <div><label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Categoria *</label><select required name="categoria" value={formData.categoria} onChange={handleChange} className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-blue-600 transition-colors text-lg font-bold text-slate-700">{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div><label className="block text-sm font-black text-blue-800 mb-2 uppercase tracking-wide">QTD EM ESTOQUE</label><input type="number" name="quantidade" value={formData.quantidade} onChange={handleChange} className="w-full px-5 py-4 border-2 border-blue-400 bg-blue-50 rounded-xl font-black outline-none focus:border-blue-700 transition-colors text-2xl text-blue-900" placeholder="0" /></div>
          <div><label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Unidade</label><select name="unidade" value={formData.unidade} onChange={handleChange} className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-blue-600 transition-colors text-lg font-bold text-slate-700">{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div>
          <div><label className="block text-sm font-black text-red-700 mb-2 uppercase tracking-wide" title="Sistema avisará quando chegar neste valor">MÍNIMO IDEAL</label><input type="number" name="estoqueMinimo" value={formData.estoqueMinimo} onChange={handleChange} className="w-full px-5 py-4 border-2 border-red-300 bg-red-50 rounded-xl font-black outline-none focus:border-red-600 transition-colors text-2xl text-red-900" placeholder="0" /></div>
          <div><label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Estado *</label><select required name="status" value={formData.status} onChange={handleChange} className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-blue-600 transition-colors text-lg font-bold text-slate-700">{STATUS.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Almoxarifado / Localização na Obra *</label>
          
          {isCustomLoc ? (
            <div className="flex gap-2">
              <input 
                type="text" 
                name="localizacao" 
                required
                value={formData.localizacao} 
                onChange={handleChange} 
                className="flex-1 px-5 py-4 border-2 border-blue-400 bg-blue-50 rounded-xl outline-none focus:border-blue-600 transition-colors text-lg font-bold text-slate-800" 
                placeholder="Digite o nome do Almoxarifado..." 
                autoComplete="off" 
                autoFocus
              />
              {locations.length > 0 && (
                <button 
                  type="button" 
                  onClick={() => {
                    setIsCustomLoc(false);
                    setFormData((prev: any) => ({ ...prev, localizacao: locations[0] || '' }));
                  }} 
                  className="px-4 border-2 border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 transition-colors font-bold"
                  title="Voltar para a lista de locais"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>
          ) : (
            <select 
              name="localizacao" 
              required
              value={formData.localizacao} 
              onChange={(e) => {
                if (e.target.value === 'NOVO_LOCAL') {
                  setIsCustomLoc(true);
                  setFormData((prev: any) => ({ ...prev, localizacao: '' }));
                } else {
                  handleChange(e);
                }
              }}
              className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-blue-600 transition-colors text-lg font-bold text-slate-800 cursor-pointer"
            >
              <option value="">Selecione o Almoxarifado...</option>
              {locations.map((loc: string) => <option key={loc} value={loc}>{loc}</option>)}
              <option value="NOVO_LOCAL" className="font-bold text-blue-700 bg-blue-50">➕ Adicionar Novo Local...</option>
            </select>
          )}
        </div>

        <div><label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Observações (Opcional)</label><textarea name="observacoes" value={formData.observacoes} onChange={handleChange} className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl resize-none outline-none focus:border-blue-600 transition-colors text-lg font-medium text-slate-700" rows={3} placeholder="Condição do material, nome do responsável..."></textarea></div>
      </div>
      
      <div className="bg-slate-50 px-8 py-6 border-t border-slate-200 flex justify-end gap-4">
        <button type="button" onClick={onCancel} className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors text-lg">Cancelar</button>
        <button type="submit" disabled={isProcessingImg} className="px-10 py-4 text-white rounded-xl font-black shadow-lg hover:shadow-xl transition-all flex items-center gap-3 text-lg" style={{ backgroundColor: colors.blue }}><Save className="w-6 h-6" style={{ color: colors.yellow }}/>{item ? 'Salvar Alterações' : 'Registrar no Estoque'}</button>
      </div>
    </form>
  );
}