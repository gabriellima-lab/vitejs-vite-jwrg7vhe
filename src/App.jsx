import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, enableIndexedDbPersistence
} from 'firebase/firestore';
import { 
  Package, Plus, Search, Edit2, Trash2, Camera, X, Save, HardHat, Wrench, Truck, Image as ImageIcon, WifiOff, CloudOff
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

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Categorias e Unidades
const CATEGORIAS = ['Materiais', 'EPI', 'Ferramentas', 'Equipamentos', 'Outros'];
const UNIDADES = ['un', 'kg', 'm', 'm²', 'm³', 'litros', 'cx', 'pct'];
const STATUS = ['Em uso', 'Disponível', 'Quebrado/Defeito', 'Falta'];

// Cores da Marca SEEL
const COLORS = { blue: '#16507A', yellow: '#FCE116' };

// Função para comprimir imagem
const processImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
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
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [view, setView] = useState('list'); 
  const [currentItem, setCurrentItem] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    try {
      enableIndexedDbPersistence(db).catch((err) => console.warn("Persistência offline:", err));
    } catch (e) { console.log(e); }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    signInAnonymously(auth).catch(error => {
      console.error("Erro auth:", error);
      alert("ATENÇÃO: O Firebase bloqueou o login anônimo. Vá ao console do Firebase > Authentication > Sign-in method e ative o 'Anônimo'.");
    });
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const inventoryRef = collection(db, 'estoque_seel');
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(), isPendingSync: doc.metadata.hasPendingWrites
      }));
      fetchedItems.sort((a, b) => a.nome.localeCompare(b.nome));
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar dados:", error);
      alert("ATENÇÃO: Erro de permissão! Vá ao Firebase > Firestore Database > Regras, e mude para: allow read, write: if true;");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (item.localizacao && item.localizacao.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === 'Todas' || item.categoria === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, filterCategory]);

  const handleSaveItem = async (formData) => {
    if (!user) {
      alert("Você não está conectado ao banco de dados. Recarregue a página.");
      return;
    }
    
    try {
      const inventoryRef = collection(db, 'estoque_seel');
      const payload = { ...formData, atualizadoPor: user.uid, ultimaAtualizacao: serverTimestamp() };

      if (currentItem && currentItem.id) {
        const docRef = doc(db, 'estoque_seel', currentItem.id);
        await updateDoc(docRef, payload);
      } else {
        payload.criadoEm = serverTimestamp();
        await addDoc(inventoryRef, payload);
      }
      setView('list'); 
      setCurrentItem(null);
    } catch (error) { 
      console.error("Erro ao salvar item:", error);
      alert("ERRO AO SALVAR: O Firebase bloqueou a gravação. Verifique as Regras do Firestore. Erro: " + error.message);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!user || !window.confirm('Tem certeza que deseja excluir este item permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'estoque_seel', id));
      if (currentItem && currentItem.id === id) setView('list');
    } catch (error) { 
      console.error("Erro:", error); 
      alert("Erro ao excluir: Sem permissão.");
    }
  };

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'EPI': return <HardHat className="w-5 h-5 text-yellow-600" />;
      case 'Ferramentas': return <Wrench className="w-5 h-5 text-gray-600" />;
      case 'Equipamentos': return <Truck className="w-5 h-5 text-blue-600" />;
      default: return <Package className="w-5 h-5 text-orange-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Disponível': return 'bg-green-100 text-green-800 border-green-200';
      case 'Em uso': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Falta': return 'bg-red-100 text-red-800 border-red-200';
      case 'Quebrado/Defeito': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 mb-4" style={{ borderColor: COLORS.blue }}></div>
        <p className="text-slate-500 font-bold animate-pulse">Carregando estoque...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {isOffline && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-bold shadow-md z-50 relative">
          <WifiOff className="w-4 h-4" /> Modo Offline Ativo. As alterações serão salvas.
        </div>
      )}

      <header className="shadow-lg sticky top-0 z-10 border-b-4 border-black/20" style={{ backgroundColor: COLORS.blue }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex flex-col select-none cursor-pointer" onClick={() => { setView('list'); setCurrentItem(null); }}>
            <div className="border-[3px] px-3 py-0.5 flex justify-center items-center" style={{ borderColor: COLORS.yellow }}>
              <span className="font-black text-3xl sm:text-4xl tracking-widest leading-none" style={{ color: COLORS.yellow, fontFamily: 'Arial Black, Impact, sans-serif' }}>SEEL</span>
            </div>
            <span className="text-[0.45rem] sm:text-[0.55rem] font-bold tracking-widest mt-1 text-center whitespace-nowrap" style={{ color: COLORS.yellow }}>SERVIÇOS ESPECIAIS DE ENGENHARIA</span>
            <div className="w-full h-[2px] sm:h-[3px] mt-0.5" style={{ backgroundColor: COLORS.yellow }}></div>
          </div>
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setCurrentItem(null); }} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-7 h-7" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {view === 'list' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input type="text" placeholder="Pesquisar material..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                {['Todas', ...CATEGORIAS].map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setFilterCategory(cat)} 
                    className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors border ${filterCategory === cat ? 'text-white border-transparent' : 'bg-white text-slate-600'}`} 
                    style={filterCategory === cat ? { backgroundColor: COLORS.blue } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {filteredItems.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
                  <Package className="w-16 h-16 mb-4 text-slate-300" />
                  <p className="text-lg font-medium">Nenhum item encontrado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-4 sm:p-4">
                  {filteredItems.map(item => (
                    <div key={item.id} className="group border-b sm:border border-slate-100 sm:rounded-xl p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 cursor-pointer relative" onClick={() => { setCurrentItem(item); setView('details'); }}>
                      {item.isPendingSync && <div className="absolute top-2 right-2 text-amber-500 bg-amber-50 rounded-full p-1"><CloudOff className="w-4 h-4" /></div>}
                      <div className="shrink-0 w-16 h-16 bg-slate-100 rounded-lg border overflow-hidden flex items-center justify-center">
                        {item.foto ? <img src={item.foto} alt={item.nome} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate mb-1">{item.nome}</h3>
                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-2 truncate">
                           {getCategoryIcon(item.categoria)} <span className="mr-2">{item.categoria}</span>
                           <span className="bg-slate-100 px-2 py-0.5 rounded truncate">📍 {item.localizacao || 'Sem local'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-black text-lg" style={{ color: COLORS.blue }}>{item.quantidade} <span className="text-sm">{item.unidade}</span></span>
                          <span className={`text-[0.7rem] px-2 py-1 rounded-md border font-bold uppercase ${getStatusColor(item.status)}`}>{item.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { setCurrentItem(null); setView('form'); }} className="fixed bottom-6 right-6 w-16 h-16 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-40" style={{ backgroundColor: COLORS.blue, border: `2px solid ${COLORS.yellow}` }}>
              <Plus className="w-8 h-8" style={{ color: COLORS.yellow }} />
            </button>
          </div>
        )}

        {view === 'details' && currentItem && (
          <div className="animate-fade-in bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden max-w-2xl mx-auto">
             {currentItem.foto && <div className="w-full h-64 bg-slate-100"><img src={currentItem.foto} className="w-full h-full object-contain" /></div>}
             <div className="p-6 md:p-8">
               <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-6">{currentItem.nome}</h2>
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                   <p className="text-xs font-bold text-slate-500 uppercase">Qtd em Estoque</p>
                   <p className="text-3xl font-black" style={{ color: COLORS.blue }}>{currentItem.quantidade} <span className="text-lg">{currentItem.unidade}</span></p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                   <p className="text-xs font-bold text-slate-500 uppercase">Localização</p>
                   <p className="text-lg font-bold text-slate-800 mt-1">{currentItem.localizacao || 'Não especificada'}</p>
                 </div>
               </div>
               
               {currentItem.observacoes && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Observações Adicionais</h3>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-700 whitespace-pre-wrap font-medium">
                    {currentItem.observacoes}
                  </div>
                </div>
               )}

               <div className="flex justify-between items-center pt-6 border-t border-slate-200">
                  <button onClick={() => handleDeleteItem(currentItem.id)} className="flex items-center gap-2 text-red-600 font-bold"><Trash2 className="w-5 h-5" /> Excluir</button>
                  <button onClick={() => setView('form')} className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-bold" style={{ backgroundColor: COLORS.blue }}><Edit2 className="w-5 h-5" /> Editar</button>
               </div>
             </div>
          </div>
        )}

        {view === 'form' && (
          <ItemForm item={currentItem} onSave={handleSaveItem} onCancel={() => setView(currentItem ? 'details' : 'list')} colors={COLORS} isOffline={isOffline} />
        )}
      </main>
    </div>
  );
}

function ItemForm({ item, onSave, onCancel, colors, isOffline }) {
  const [formData, setFormData] = useState(item || { nome: '', categoria: 'Materiais', quantidade: 0, unidade: 'un', status: 'Disponível', localizacao: '', observacoes: '', foto: '' });
  const [isProcessingImg, setIsProcessingImg] = useState(false);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.name === 'quantidade' ? Number(e.target.value) : e.target.value }));

  const handleImageUpload = async (e) => {
    if (!e.target.files[0]) return;
    setIsProcessingImg(true);
    try {
      const base64Img = await processImage(e.target.files[0]);
      setFormData(prev => ({ ...prev, foto: base64Img }));
    } catch (err) { alert("Erro ao carregar imagem."); } finally { setIsProcessingImg(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) return alert("O Nome do Item é obrigatório.");
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in bg-white rounded-xl shadow-lg border border-slate-200 max-w-2xl mx-auto">
      <div className="px-6 py-5 border-b border-slate-200"><h2 className="text-2xl font-black">{item ? 'Editar Item' : 'Novo Registro'}</h2></div>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-32 h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden relative bg-slate-50">
             {formData.foto ? <><img src={formData.foto} className="w-full h-full object-cover" /><button type="button" onClick={() => setFormData(prev => ({...prev, foto:''}))} className="absolute top-2 right-2 bg-white rounded-full p-1"><X className="w-4 h-4 text-red-500"/></button></> : <Camera className="w-10 h-10 text-slate-300" />}
          </div>
          <div className="flex-1">
             <label className="cursor-pointer bg-white border-2 border-slate-200 px-5 py-3 rounded-xl font-bold inline-flex items-center gap-2"><Camera className="w-5 h-5" /> Adicionar Foto <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/></label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className="block text-xs font-bold text-slate-500 mb-2">Nome do Item *</label><input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl" /></div>
          <div><label className="block text-xs font-bold text-slate-500 mb-2">Categoria</label><select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white">{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div><label className="block text-xs font-bold text-slate-500 mb-2">Qtd</label><input type="number" name="quantidade" value={formData.quantidade} onChange={handleChange} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-black" /></div>
          <div><label className="block text-xs font-bold text-slate-500 mb-2">Unidade</label><select name="unidade" value={formData.unidade} onChange={handleChange} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white">{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-500 mb-2">Estado</label><select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white">{STATUS.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div><label className="block text-xs font-bold text-slate-500 mb-2">Localização na Obra</label><input type="text" name="localizacao" value={formData.localizacao} onChange={handleChange} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl" /></div>
        <div><label className="block text-xs font-bold text-slate-500 mb-2">Observações</label><textarea name="observacoes" value={formData.observacoes} onChange={handleChange} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl resize-none"></textarea></div>
      </div>
      <div className="bg-slate-50 px-6 py-5 border-t border-slate-200 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-6 py-3 border-2 border-slate-200 rounded-xl font-bold">Cancelar</button>
        <button type="submit" disabled={isProcessingImg} className="px-8 py-3 text-white rounded-xl font-bold" style={{ backgroundColor: colors.blue }}>{item ? 'Salvar' : 'Registrar'}</button>
      </div>
    </form>
  );
}