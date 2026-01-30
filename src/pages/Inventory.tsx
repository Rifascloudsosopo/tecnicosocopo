import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  Filter,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface SparePart {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model_compatibility: string | null;
  purchase_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
}

const categories = ['Todas', 'Pantallas', 'Baterías', 'Flexores', 'Cámaras', 'Carcasas', 'Otros'];

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [parts, setParts] = useState<SparePart[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { insertWithSync, updateWithSync, deleteWithSync, fetchAndCache } = useOfflineSync();

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    model_compatibility: '',
    purchase_price: '',
    sale_price: '',
    stock: '',
    min_stock: '5',
  });

  useEffect(() => {
    loadParts();
  }, []);

  async function loadParts() {
    setLoading(true);
    try {
      const data = await fetchAndCache<SparePart & { created_at?: string }>('spare_parts');
      setParts(data.sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ) as SparePart[]);
    } catch (error: any) {
      console.error('Error loading parts:', error);
      toast({
        title: 'Error al cargar inventario',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.category || !formData.purchase_price || !formData.sale_price) {
      toast({
        title: 'Campos requeridos',
        description: 'Complete todos los campos obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const partData = {
        name: formData.name.trim(),
        category: formData.category,
        brand: formData.brand.trim() || null,
        model_compatibility: formData.model_compatibility.trim() || null,
        purchase_price: parseFloat(formData.purchase_price),
        sale_price: parseFloat(formData.sale_price),
        stock: parseInt(formData.stock) || 0,
        min_stock: parseInt(formData.min_stock) || 5,
      };

      if (editingPart) {
        const updated = await updateWithSync<SparePart>('spare_parts', {
          ...editingPart,
          ...partData,
        });
        setParts(parts.map(p => p.id === updated.id ? updated : p));
        toast({ title: 'Repuesto actualizado' });
      } else {
        const newPart = await insertWithSync<SparePart>('spare_parts', partData as any);
        setParts([newPart, ...parts]);
        toast({
          title: 'Repuesto agregado',
          description: `${newPart.name} ha sido registrado`,
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving part:', error);
      toast({
        title: 'Error al guardar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function deletePart(part: SparePart) {
    if (!confirm(`¿Eliminar ${part.name}?`)) return;

    try {
      await deleteWithSync('spare_parts', part.id);
      setParts(parts.filter((p) => p.id !== part.id));
      toast({ title: 'Repuesto eliminado' });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function handleEdit(part: SparePart) {
    setEditingPart(part);
    setFormData({
      name: part.name,
      category: part.category,
      brand: part.brand || '',
      model_compatibility: part.model_compatibility || '',
      purchase_price: String(part.purchase_price),
      sale_price: String(part.sale_price),
      stock: String(part.stock),
      min_stock: String(part.min_stock),
    });
    setIsDialogOpen(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      category: '',
      brand: '',
      model_compatibility: '',
      purchase_price: '',
      sale_price: '',
      stock: '',
      min_stock: '5',
    });
    setEditingPart(null);
  }

  const filteredParts = parts.filter((part) => {
    const matchesSearch =
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesCategory =
      categoryFilter === 'Todas' || part.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const lowStockParts = parts.filter((p) => p.stock <= p.min_stock);

  // Mobile Card Component
  const PartCard = ({ part }: { part: SparePart }) => {
    const isLowStock = part.stock <= part.min_stock;
    const isOutOfStock = part.stock === 0;

    return (
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{part.name}</p>
              {part.brand && (
                <p className="text-sm text-muted-foreground">{part.brand}</p>
              )}
            </div>
          </div>
          <span className="status-badge bg-secondary text-secondary-foreground text-xs">
            {part.category}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Compra</p>
            <p className="font-medium">${part.purchase_price}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Venta</p>
            <p className="font-medium text-success">${part.sale_price}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stock</p>
            <p className={cn(
              'font-bold',
              isOutOfStock && 'text-destructive',
              isLowStock && !isOutOfStock && 'text-warning',
              !isLowStock && 'text-foreground'
            )}>
              {part.stock} <span className="font-normal text-xs">/ {part.min_stock}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(part)}>
            <Edit className="w-4 h-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30"
            onClick={() => deletePart(part)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Inventario</h1>
            <p className="text-muted-foreground mt-1">
              Control de repuestos ({parts.length} items)
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Nuevo Repuesto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPart ? 'Editar Repuesto' : 'Agregar Repuesto'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Repuesto *</Label>
                  <Input
                    id="name"
                    placeholder="Pantalla Samsung Galaxy..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.slice(1).map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      placeholder="Samsung, Apple..."
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compatibility">Modelos Compatibles</Label>
                  <Input
                    id="compatibility"
                    placeholder="Galaxy S23, S23+..."
                    value={formData.model_compatibility}
                    onChange={(e) => setFormData({ ...formData, model_compatibility: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_price">Precio Compra ($) *</Label>
                    <Input
                      id="purchase_price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale_price">Precio Venta ($) *</Label>
                    <Input
                      id="sale_price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Inicial</Label>
                    <Input
                      id="stock"
                      type="number"
                      placeholder="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_stock">Stock Mínimo</Label>
                    <Input
                      id="min_stock"
                      type="number"
                      placeholder="5"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      editingPart ? 'Actualizar' : 'Guardar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Low Stock Alert */}
        {lowStockParts.length > 0 && (
          <div className="glass-card rounded-xl p-4 mb-6 border-l-4 border-l-warning">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {lowStockParts.length} repuesto{lowStockParts.length > 1 ? 's' : ''} con stock bajo
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {lowStockParts.slice(0, 3).map((p) => p.name).join(', ')}
                  {lowStockParts.length > 3 && ` y ${lowStockParts.length - 3} más`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar repuesto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-search"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground hidden sm:block" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Cargando inventario...</span>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            {isMobile ? (
              <div className="space-y-4">
                {filteredParts.map((part) => (
                  <PartCard key={part.id} part={part} />
                ))}
              </div>
            ) : (
              /* Desktop Table View */
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="table-header">
                        <th className="px-5 py-3 text-left">Repuesto</th>
                        <th className="px-5 py-3 text-left">Categoría</th>
                        <th className="px-5 py-3 text-left">Compatibilidad</th>
                        <th className="px-5 py-3 text-right">P. Compra</th>
                        <th className="px-5 py-3 text-right">P. Venta</th>
                        <th className="px-5 py-3 text-center">Stock</th>
                        <th className="px-5 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredParts.map((part) => {
                        const isLowStock = part.stock <= part.min_stock;
                        const isOutOfStock = part.stock === 0;

                        return (
                          <tr key={part.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Package className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{part.name}</p>
                                  {part.brand && (
                                    <p className="text-sm text-muted-foreground">{part.brand}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="status-badge bg-secondary text-secondary-foreground">
                                {part.category}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">
                              {part.model_compatibility || '-'}
                            </td>
                            <td className="px-5 py-4 text-right font-medium">
                              ${part.purchase_price.toFixed(2)}
                            </td>
                            <td className="px-5 py-4 text-right font-semibold text-success">
                              ${part.sale_price.toFixed(2)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span
                                className={cn(
                                  'font-bold text-lg',
                                  isOutOfStock && 'text-destructive',
                                  isLowStock && !isOutOfStock && 'text-warning',
                                  !isLowStock && 'text-foreground'
                                )}
                              >
                                {part.stock}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">
                                / {part.min_stock} min
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(part)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => deletePart(part)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {filteredParts.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No se encontraron repuestos</p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Agregar primer repuesto
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
