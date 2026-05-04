import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, ImageOff } from 'lucide-react';
import { fetchMenu, createMenuItem, updateMenuItem, deleteMenuItem } from '../api/menu';
import type { MenuItem } from '../types';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-[#25D366]' : 'bg-[#333]'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4.5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => updateMenuItem(item.id, { is_available: !item.is_available }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMenuItem(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });

  return (
    <div className={`bg-[#111111] border border-[#262626] rounded-2xl overflow-hidden transition-opacity ${!item.is_available ? 'opacity-60' : ''}`}>
      {/* Image */}
      <div className="aspect-square bg-[#1a1a1a] relative overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={28} color="#333" />
          </div>
        )}
        <button
          onClick={() => { if (confirm('Delete this item?')) deleteMutation.mutate(); }}
          className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-500/80 rounded-full flex items-center justify-center transition-colors"
        >
          <Trash2 size={13} color="#fff" />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <p className="text-sm font-medium text-white leading-tight">{item.name}</p>
          <p className="text-[10px] text-[#888] mt-0.5">{item.category}</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-[#25D366]">₹{Number(item.price).toLocaleString('en-IN')}</span>
            {item.original_price && (
              <span className="text-xs text-[#666] line-through ml-1.5">₹{Number(item.original_price).toLocaleString('en-IN')}</span>
            )}
          </div>
          <ToggleSwitch on={item.is_available} onChange={() => toggleMutation.mutate()} />
        </div>
      </div>
    </div>
  );
}

interface AddItemForm {
  name: string;
  category: string;
  price: string;
  original_price: string;
  image_url: string;
  is_available: boolean;
}

const EMPTY_FORM: AddItemForm = { name: '', category: '', price: '', original_price: '', image_url: '', is_available: true };

function AddItemModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AddItemForm>(EMPTY_FORM);
  const [error, setError] = useState('');

  const set = (field: keyof AddItemForm, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const mutation = useMutation({
    mutationFn: () => createMenuItem({
      name: form.name.trim(),
      category: form.category.trim(),
      price: parseFloat(form.price),
      ...(form.original_price ? { original_price: parseFloat(form.original_price) } : {}),
      ...(form.image_url ? { image_url: form.image_url.trim() } : {}),
      is_available: form.is_available,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); onClose(); },
    onError: () => setError('Failed to add item. Check all fields.'),
  });

  const valid = form.name && form.category && form.price && !isNaN(parseFloat(form.price));

  const field = (label: string, key: keyof AddItemForm, opts?: { type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs text-[#888] mb-1">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        placeholder={opts?.placeholder}
        value={form[key] as string}
        onChange={e => set(key, e.target.value)}
        className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#25D366] transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-[#111111] border border-[#262626] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Add Menu Item</h2>
          <button onClick={onClose} className="text-[#888] hover:text-white"><X size={18} /></button>
        </div>

        {field('Name *', 'name', { placeholder: 'Butter Chicken' })}
        {field('Category *', 'category', { placeholder: 'Main Course' })}

        <div className="grid grid-cols-2 gap-3">
          {field('Price (₹) *', 'price', { type: 'number', placeholder: '150' })}
          {field('Original Price (₹)', 'original_price', { type: 'number', placeholder: '200' })}
        </div>

        {field('Image URL', 'image_url', { placeholder: 'https://...' })}

        <div className="flex items-center justify-between">
          <span className="text-sm text-[#aaa]">Available now</span>
          <ToggleSwitch on={form.is_available} onChange={() => set('is_available', !form.is_available)} />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          className="w-full bg-[#25D366] hover:bg-[#1ea855] disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
        >
          {mutation.isPending ? <Spinner size={16} /> : null}
          Add Item
        </button>
      </div>
    </div>
  );
}

export default function Menu() {
  const [showModal, setShowModal] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu'],
    queryFn: fetchMenu,
  });

  const categories = [...new Set(items.map(i => i.category))].sort();

  return (
    <Layout
      title="Menu"
      action={
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ea855] text-white text-xs font-semibold rounded-xl px-3 py-2 transition-colors"
        >
          <Plus size={14} /> Add Item
        </button>
      }
    >
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-[#555]">
            <p className="text-4xl mb-3">🍳</p>
            <p className="text-sm mb-4">No menu items yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#25D366] text-white text-sm font-semibold rounded-xl px-4 py-2"
            >
              Add your first item
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                <h3 className="text-xs text-[#888] uppercase tracking-wider font-medium mb-3">{cat}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {items.filter(i => i.category === cat).map(item => (
                    <MenuCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && <AddItemModal onClose={() => setShowModal(false)} />}
    </Layout>
  );
}
