import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  Filter,
  Edit,
  Trash2,
  Loader2,
  ArrowUpDown,
  Calendar,
  Tag,
  Minus,
  PlusCircle,
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SimplePagination } from '@/components/ui/SimplePagination';

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
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  created_at: string;
}

interface DeleteCategoryState {
  category: Category | null;
  productsCount: number;
  newCategory: string;
}

type SortField = 'name' | 'sale_price' | 'purchase_price' | 'created_at' | 'stock';
type SortDirection = 'asc' | 'desc';

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [parts, setParts] = useState<SparePart[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [stockAdjustPart, setStockAdjustPart] = useState<SparePart | null>(null);
  const [stockAdjustAmount, setStockAdjustAmount] = useState('');
  const [stockAdjustType, setStockAdjustType] = useState<'add' | 'subtract'>('add');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteCategoryState, setDeleteCategoryState] = useState<DeleteCategoryState>({
    category: null,
    productsCount: 0,
    newCategory: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { insertWithSync, updateWithSync, deleteWithSync, fetchAndCache } = useOfflineSync();
  const { can, isAdmin, loading: permissionsLoading } = usePermissions();

  const canManageInventory = isAdmin || can('manage_inventory');

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
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [partsData, categoriesData] = await Promise.all([
        fetchAndCache<SparePart>('spare_parts'),
        supabase.from('inventory_categories').select('*').order('name'),
      ]);
      
      setParts(partsData);
      
      if (categoriesData.data) {
        setCategories(categoriesData.data);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
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

    if (!canManageInventory) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para gestionar inventario',
        variant: 'destructive',
      });
      return;
    }

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

  async function handleAddCategory() {
    if (!canManageInventory) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para gestionar categorías',
        variant: 'destructive',
      });
      return;
    }

    if (!newCategoryName.trim()) {
      toast({
        title: 'Nombre requerido',
        description: 'Ingresa un nombre para la categoría',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('inventory_categories')
        .insert({ name: newCategoryName.trim() })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data]);
      setNewCategoryName('');
      setIsCategoryDialogOpen(false);
      toast({ title: 'Categoría agregada' });
    } catch (error: any) {
      toast({
        title: 'Error al crear categoría',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(category: Category) {
    if (!canManageInventory) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para eliminar categorías',
        variant: 'destructive',
      });
      return;
    }

    // Count products in this category
    const productsInCategory = parts.filter(p => p.category === category.name);
    
    if (productsInCategory.length > 0) {
      // Show dialog to reassign products
      setDeleteCategoryState({
        category,
        productsCount: productsInCategory.length,
        newCategory: '',
      });
    } else {
      // Delete directly
      await confirmDeleteCategory(category.id);
    }
  }

  async function confirmDeleteCategory(categoryId: string, newCategoryName?: string) {
    setSaving(true);
    try {
      const categoryToDelete = deleteCategoryState.category || categories.find(c => c.id === categoryId);
      
      if (newCategoryName && categoryToDelete) {
        // Update all products to new category
        const { error: updateError } = await supabase
          .from('spare_parts')
          .update({ category: newCategoryName })
          .eq('category', categoryToDelete.name);

        if (updateError) throw updateError;

        // Update local state
        setParts(parts.map(p => 
          p.category === categoryToDelete.name 
            ? { ...p, category: newCategoryName } 
            : p
        ));
      }

      // Delete category
      const { error } = await supabase
        .from('inventory_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(categories.filter(c => c.id !== categoryId));
      setDeleteCategoryState({ category: null, productsCount: 0, newCategory: '' });
      toast({ title: 'Categoría eliminada' });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar categoría',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStockAdjust() {
    if (!canManageInventory || !stockAdjustPart) return;

    const amount = parseInt(stockAdjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Cantidad inválida',
        description: 'Ingresa una cantidad válida mayor a 0',
        variant: 'destructive',
      });
      return;
    }

    const newStock = stockAdjustType === 'add' 
      ? stockAdjustPart.stock + amount 
      : Math.max(0, stockAdjustPart.stock - amount);

    setSaving(true);
    try {
      const updated = await updateWithSync<SparePart>('spare_parts', {
        ...stockAdjustPart,
        stock: newStock,
      });
      setParts(parts.map(p => p.id === updated.id ? updated : p));
      toast({ 
        title: 'Stock actualizado',
        description: `${stockAdjustPart.name}: ${stockAdjustPart.stock} → ${newStock}`,
      });
      setIsStockDialogOpen(false);
      setStockAdjustPart(null);
      setStockAdjustAmount('');
    } catch (error: any) {
      toast({
        title: 'Error al actualizar stock',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function deletePart(part: SparePart) {
    if (!canManageInventory) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para eliminar repuestos',
        variant: 'destructive',
      });
      return;
    }

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
    if (!canManageInventory) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para editar repuestos',
        variant: 'destructive',
      });
      return;
    }
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

  function handleStockDialog(part: SparePart) {
    if (!canManageInventory) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para ajustar stock',
        variant: 'destructive',
      });
      return;
    }
    setStockAdjustPart(part);
    setStockAdjustAmount('');
    setStockAdjustType('add');
    setIsStockDialogOpen(true);
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

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedParts = [...parts].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'sale_price':
        comparison = a.sale_price - b.sale_price;
        break;
      case 'purchase_price':
        comparison = a.purchase_price - b.purchase_price;
        break;
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'stock':
        comparison = a.stock - b.stock;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const filteredParts = sortedParts.filter((part) => {
    const matchesSearch =
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesCategory =
      categoryFilter === 'Todas' || part.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Pagination
  const totalPages = Math.ceil(filteredParts.length / itemsPerPage);
  const paginatedParts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredParts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredParts, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, sortField, sortDirection]);

  const lowStockParts = parts.filter((p) => p.stock <= p.min_stock);

  const categoryOptions = ['Todas', ...categories.map(c => c.name)];

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

        <div className="grid grid-cols-3 gap-2 text-sm mb-2">
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

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Calendar className="w-3 h-3" />
          <span>Ingresado: {format(new Date(part.created_at), 'dd/MM/yyyy', { locale: es })}</span>
        </div>

        {canManageInventory && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleStockDialog(part)}>
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Stock
            </Button>
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
        )}
      </div>
    );
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors",
        sortField === field ? "text-primary font-semibold" : "text-muted-foreground"
      )}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

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
          <div className="flex gap-2">
            {canManageInventory && (
              <>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Tag className="w-4 h-4" />
                      <span className="hidden sm:inline">Categorías</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Gestionar Categorías</DialogTitle>
                      <DialogDescription>Agrega nuevas categorías para organizar tu inventario</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nueva categoría..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                        <Button onClick={handleAddCategory} disabled={saving}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                        {categories.length === 0 ? (
                          <p className="p-4 text-center text-muted-foreground text-sm">No hay categorías</p>
                        ) : (
                          categories.map((cat) => {
                            const productCount = parts.filter(p => p.category === cat.name).length;
                            return (
                              <div key={cat.id} className="p-3 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium">{cat.name}</span>
                                  {productCount > 0 && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({productCount} productos)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground hidden sm:block">
                                    {format(new Date(cat.created_at), 'dd/MM/yyyy', { locale: es })}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteCategory(cat)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
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
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>
                                  {cat.name}
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
              </>
            )}
          </div>
        </div>

        {/* Stock Adjustment Dialog */}
        <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Ajustar Stock</DialogTitle>
              <DialogDescription>
                {stockAdjustPart?.name} - Stock actual: {stockAdjustPart?.stock}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Button
                  variant={stockAdjustType === 'add' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setStockAdjustType('add')}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Agregar
                </Button>
                <Button
                  variant={stockAdjustType === 'subtract' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setStockAdjustType('subtract')}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Restar
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={stockAdjustAmount}
                  onChange={(e) => setStockAdjustAmount(e.target.value)}
                />
              </div>
              {stockAdjustAmount && parseInt(stockAdjustAmount) > 0 && (
                <p className="text-sm text-muted-foreground">
                  Nuevo stock: {stockAdjustType === 'add' 
                    ? (stockAdjustPart?.stock || 0) + parseInt(stockAdjustAmount)
                    : Math.max(0, (stockAdjustPart?.stock || 0) - parseInt(stockAdjustAmount))}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStockDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleStockAdjust} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
          <div className="flex flex-col gap-3">
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
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Sort options */}
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="text-muted-foreground">Ordenar por:</span>
              <SortButton field="name" label="Nombre" />
              <SortButton field="sale_price" label="P. Venta" />
              <SortButton field="purchase_price" label="P. Compra" />
              <SortButton field="stock" label="Stock" />
              <SortButton field="created_at" label="Fecha" />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading || permissionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Cargando inventario...</span>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            {isMobile ? (
              <div className="space-y-4">
                {paginatedParts.map((part) => (
                  <PartCard key={part.id} part={part} />
                ))}
                <SimplePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredParts.length}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            ) : (
              /* Desktop Table View */
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="table-header">
                        <th className="px-3 py-2 text-left text-xs">Repuesto</th>
                        <th className="px-3 py-2 text-left text-xs">Categoría</th>
                        <th className="px-3 py-2 text-left text-xs">Compatibilidad</th>
                        <th className="px-3 py-2 text-right text-xs">P. Compra</th>
                        <th className="px-3 py-2 text-right text-xs">P. Venta</th>
                        <th className="px-3 py-2 text-center text-xs">Stock</th>
                        <th className="px-3 py-2 text-center text-xs">Fecha</th>
                        {canManageInventory && <th className="px-3 py-2 text-center text-xs">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedParts.map((part) => {
                        const isLowStock = part.stock <= part.min_stock;
                        const isOutOfStock = part.stock === 0;

                        return (
                          <tr key={part.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-md bg-primary/10">
                                  <Package className="w-3 h-3 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{part.name}</p>
                                  {part.brand && (
                                    <p className="text-xs text-muted-foreground">{part.brand}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="status-badge bg-secondary text-secondary-foreground text-xs px-2 py-0.5">
                                {part.category}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {part.model_compatibility || '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-sm">
                              ${part.purchase_price.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-success">
                              ${part.sale_price.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={cn(
                                  'font-bold text-sm',
                                  isOutOfStock && 'text-destructive',
                                  isLowStock && !isOutOfStock && 'text-warning',
                                  !isLowStock && 'text-foreground'
                                )}
                              >
                                {part.stock}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">
                                /{part.min_stock}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                              {format(new Date(part.created_at), 'dd/MM/yy', { locale: es })}
                            </td>
                            {canManageInventory && (
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-0.5">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => handleStockDialog(part)}
                                    title="Ajustar stock"
                                  >
                                    <ArrowUpDown className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => handleEdit(part)}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => deletePart(part)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <SimplePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredParts.length}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            )}

            {filteredParts.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No se encontraron repuestos</p>
                {canManageInventory && (
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => setIsDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar primer repuesto
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {/* Delete Category Confirmation Dialog */}
        <Dialog 
          open={!!deleteCategoryState.category} 
          onOpenChange={(open) => !open && setDeleteCategoryState({ category: null, productsCount: 0, newCategory: '' })}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Eliminar Categoría
              </DialogTitle>
              <DialogDescription>
                La categoría "{deleteCategoryState.category?.name}" tiene {deleteCategoryState.productsCount} producto(s) asociado(s).
                Selecciona una nueva categoría para estos productos antes de eliminar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nueva categoría para los productos</Label>
                <Select
                  value={deleteCategoryState.newCategory}
                  onValueChange={(v) => setDeleteCategoryState({ ...deleteCategoryState, newCategory: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter(c => c.id !== deleteCategoryState.category?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={() => setDeleteCategoryState({ category: null, productsCount: 0, newCategory: '' })}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={() => confirmDeleteCategory(deleteCategoryState.category!.id, deleteCategoryState.newCategory)}
                disabled={!deleteCategoryState.newCategory || saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Eliminar y Reasignar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
