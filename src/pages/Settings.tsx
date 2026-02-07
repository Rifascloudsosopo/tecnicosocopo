import { useState, useRef } from 'react';
import { Building2, Save, Upload, Download, UploadCloud, Loader2, AlertTriangle, Link2, Printer, Trash2, Calendar } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { createBackup, downloadBackup, restoreBackup, parseBackupFile, BackupData } from '@/lib/backup';

export default function Settings() {
  const { toast } = useToast();
  const { settings, isLoading, updateSettings, isSaving } = useCompanySettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Delete orders state
  const [deleteBeforeDate, setDeleteBeforeDate] = useState('');
  const [ordersToDelete, setOrdersToDelete] = useState<number>(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCountingOrders, setIsCountingOrders] = useState(false);

  // Local form state
  const [formData, setFormData] = useState({
    name: '',
    rif: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    default_warranty_days: '30',
    abandonment_days: '90',
    printer_size: '80mm',
    terms_conditions: '',
  });

  // Track if form has been initialized from settings
  const [formInitialized, setFormInitialized] = useState(false);

  // Sync form data when settings load (only once)
  if (settings && !formInitialized) {
    setFormData({
      name: settings.name || '',
      rif: settings.rif || '',
      address: settings.address || '',
      phone: settings.phone || '',
      email: settings.email || '',
      logo_url: settings.logo_url || '',
      default_warranty_days: String(settings.default_warranty_days || 30),
      abandonment_days: String(settings.abandonment_days || 90),
      printer_size: (settings as any).printer_size || '80mm',
      terms_conditions: settings.terms_conditions || '',
    });
    setFormInitialized(true);
  }

  async function handleSave() {
    updateSettings({
      name: formData.name,
      rif: formData.rif || null,
      address: formData.address || null,
      phone: formData.phone || null,
      email: formData.email || null,
      logo_url: formData.logo_url || null,
      default_warranty_days: parseInt(formData.default_warranty_days),
      abandonment_days: parseInt(formData.abandonment_days),
      terms_conditions: formData.terms_conditions,
    } as any);

    // Also update printer_size separately since it might not be in the type
    if (settings?.id) {
      await (supabase
        .from('company_settings') as any)
        .update({ printer_size: formData.printer_size })
        .eq('id', settings.id);
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Archivo inválido',
        description: 'Por favor selecciona una imagen (PNG, JPG)',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El archivo debe ser menor a 1MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      // Update form and save
      setFormData({ ...formData, logo_url: logoUrl });
      
      if (settings?.id) {
        await (supabase
          .from('company_settings') as any)
          .update({ logo_url: logoUrl })
          .eq('id', settings.id);
      }

      toast({ title: 'Logo subido exitosamente' });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error al subir logo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  }

  async function handleDownloadBackup() {
    setBackingUp(true);
    try {
      const backup = await createBackup();
      downloadBackup(backup);
      toast({ title: 'Respaldo descargado exitosamente' });
    } catch (error: any) {
      toast({
        title: 'Error al crear respaldo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBackingUp(false);
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const backup = await parseBackupFile(file);
      setPendingBackup(backup);
      setShowRestoreDialog(true);
    } catch (error: any) {
      toast({
        title: 'Error al leer archivo',
        description: error.message,
        variant: 'destructive',
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleConfirmRestore() {
    if (!pendingBackup) return;

    setRestoring(true);
    setShowRestoreDialog(false);

    try {
      const result = await restoreBackup(pendingBackup);
      
      if (result.success) {
        toast({ title: 'Respaldo restaurado exitosamente' });
        window.location.reload();
      } else {
        toast({
          title: 'Restauración parcial',
          description: `${result.errors.length} error(es): ${result.errors[0]}`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error al restaurar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
      setPendingBackup(null);
    }
  }

  async function handleCountOrdersToDelete() {
    if (!deleteBeforeDate) {
      toast({
        title: 'Selecciona una fecha',
        description: 'Debes seleccionar una fecha límite para buscar órdenes.',
        variant: 'destructive',
      });
      return;
    }

    setIsCountingOrders(true);
    try {
      const { count, error } = await supabase
        .from('service_orders')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', deleteBeforeDate);

      if (error) throw error;

      setOrdersToDelete(count || 0);
      
      if (count === 0) {
        toast({
          title: 'Sin órdenes',
          description: 'No hay órdenes anteriores a la fecha seleccionada.',
        });
      } else {
        setShowDeleteDialog(true);
      }
    } catch (error: any) {
      toast({
        title: 'Error al contar órdenes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCountingOrders(false);
    }
  }

  async function handleDeleteOrders() {
    if (deleteConfirmText.toLowerCase() !== 'borrar') {
      toast({
        title: 'Confirmación incorrecta',
        description: 'Debes escribir "borrar" para confirmar.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      // First delete related records (due to foreign keys)
      const { data: orderIds } = await supabase
        .from('service_orders')
        .select('id')
        .lt('created_at', deleteBeforeDate);

      if (orderIds && orderIds.length > 0) {
        const ids = orderIds.map(o => o.id);
        
        // Delete related records in order
        await supabase.from('spare_parts_usage').delete().in('order_id', ids);
        await supabase.from('order_additional_costs').delete().in('order_id', ids);
        await supabase.from('order_payments').delete().in('order_id', ids);
        
        // Finally delete the orders
        const { error } = await supabase
          .from('service_orders')
          .delete()
          .in('id', ids);

        if (error) throw error;

        toast({
          title: 'Órdenes eliminadas',
          description: `Se eliminaron ${ids.length} órdenes exitosamente.`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
      setOrdersToDelete(0);
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground mt-1">
            Personaliza la configuración del taller
          </p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
            <TabsTrigger value="company">Empresa</TabsTrigger>
            <TabsTrigger value="service">Servicio</TabsTrigger>
            <TabsTrigger value="printer">Impresora</TabsTrigger>
            <TabsTrigger value="legal">Legal</TabsTrigger>
            <TabsTrigger value="backup">Respaldo</TabsTrigger>
            <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
          </TabsList>

          {/* Company Tab */}
          <TabsContent value="company">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Datos de la Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border overflow-hidden">
                    {formData.logo_url ? (
                      <img 
                        src={formData.logo_url} 
                        alt="Logo" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Subir Logo
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      PNG o JPG, máximo 1MB
                    </p>
                  </div>
                </div>

                {/* Logo URL */}
                <div className="space-y-2">
                  <Label htmlFor="logo_url" className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    URL del Logo (alternativo)
                  </Label>
                  <Input
                    id="logo_url"
                    placeholder="https://ejemplo.com/mi-logo.png"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Puedes usar una URL externa en lugar de subir el archivo
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Taller</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rif">RIF / NIT</Label>
                    <Input
                      id="rif"
                      value={formData.rif}
                      onChange={(e) => setFormData({ ...formData, rif: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Service Tab */}
          <TabsContent value="service">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Parámetros de Servicio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="warranty">Días de Garantía por Defecto</Label>
                    <Select
                      value={formData.default_warranty_days}
                      onValueChange={(v) => setFormData({ ...formData, default_warranty_days: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 días</SelectItem>
                        <SelectItem value="15">15 días</SelectItem>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                        <SelectItem value="90">90 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="abandonment">Días para Abandono</Label>
                    <Select
                      value={formData.abandonment_days}
                      onValueChange={(v) => setFormData({ ...formData, abandonment_days: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                        <SelectItem value="90">90 días</SelectItem>
                        <SelectItem value="120">120 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Información</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• La garantía aplica desde la fecha de entrega del equipo.</li>
                    <li>• Los equipos se marcarán como abandonados después de {formData.abandonment_days} días sin retirar.</li>
                  </ul>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Printer Tab */}
          <TabsContent value="printer">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary" />
                  Configuración de Impresora
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Tamaño de Papel para Tickets</Label>
                  <Select
                    value={formData.printer_size}
                    onValueChange={(v) => setFormData({ ...formData, printer_size: v })}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm (Impresora pequeña)</SelectItem>
                      <SelectItem value="80mm">80mm (Estándar POS)</SelectItem>
                      <SelectItem value="110mm">110mm (Impresora ancha)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecciona el ancho de papel de tu impresora térmica
                  </p>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium">Vista previa del ancho</h4>
                  <div className="flex gap-4">
                    <div className={`h-24 bg-background border-2 border-dashed rounded transition-all ${
                      formData.printer_size === '58mm' ? 'border-primary w-24' :
                      formData.printer_size === '80mm' ? 'border-primary w-32' :
                      'border-primary w-40'
                    }`}>
                      <div className="p-2 text-xs text-center text-muted-foreground">
                        {formData.printer_size}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Legal Tab */}
          <TabsContent value="legal">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Términos y Condiciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="terms">Texto para Tickets de Entrada</Label>
                  <Textarea
                    id="terms"
                    value={formData.terms_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                    className="min-h-48 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este texto aparecerá en los tickets de entrada impresos.
                  </p>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Respaldo y Restauración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Download Backup */}
                <div className="p-6 border border-border rounded-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Download className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Descargar Respaldo</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Descarga todos los datos del sistema en un archivo JSON.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleDownloadBackup}
                      disabled={backingUp}
                      className="gap-2 w-full sm:w-auto"
                    >
                      {backingUp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Descargar
                    </Button>
                  </div>
                </div>

                {/* Restore Backup */}
                <div className="p-6 border border-border rounded-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-warning/10">
                        <UploadCloud className="w-6 h-6 text-warning" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Restaurar Respaldo</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Restaura los datos desde un archivo de respaldo previo.
                        </p>
                      </div>
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={restoring}
                        className="gap-2 w-full sm:w-auto"
                      >
                        {restoring ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UploadCloud className="w-4 h-4" />
                        )}
                        Seleccionar Archivo
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-warning">Importante</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Restaurar un respaldo reemplazará los datos existentes. Se recomienda descargar un respaldo actual antes de restaurar.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  Mantenimiento de Datos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Delete Old Orders */}
                <div className="p-6 border border-destructive/30 rounded-lg bg-destructive/5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-destructive/10">
                      <Calendar className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-destructive">Eliminar Órdenes Antiguas</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Elimina permanentemente las órdenes de servicio anteriores a una fecha específica.
                        Esta acción también eliminará los pagos, costos adicionales y repuestos asociados.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="deleteDate">Eliminar órdenes anteriores a:</Label>
                        <Input
                          id="deleteDate"
                          type="date"
                          value={deleteBeforeDate}
                          onChange={(e) => setDeleteBeforeDate(e.target.value)}
                          className="w-full sm:w-64"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="destructive"
                          onClick={handleCountOrdersToDelete}
                          disabled={isCountingOrders || !deleteBeforeDate}
                          className="gap-2"
                        >
                          {isCountingOrders ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Buscar y Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">¡Acción Irreversible!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        La eliminación de órdenes es permanente y no se puede deshacer. 
                        Se recomienda <strong>descargar un respaldo completo</strong> antes de eliminar datos.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar respaldo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción reemplazará todos los datos actuales con los del archivo de respaldo.
              {pendingBackup && (
                <span className="block mt-2 text-foreground">
                  Fecha del respaldo: {new Date(pendingBackup.timestamp).toLocaleString('es-ES')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBackup(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Orders Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) {
          setDeleteConfirmText('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Eliminación
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Estás a punto de eliminar <strong className="text-destructive">{ordersToDelete} órdenes</strong> de servicio 
                  anteriores al {new Date(deleteBeforeDate).toLocaleDateString('es-ES')}.
                </p>
                <p>
                  Esta acción es <strong>permanente e irreversible</strong>. También se eliminarán todos los pagos, 
                  costos adicionales y repuestos asociados a estas órdenes.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="confirmDelete">
                    Para confirmar, escribe <strong className="text-destructive">borrar</strong> a continuación:
                  </Label>
                  <Input
                    id="confirmDelete"
                    placeholder="Escribe 'borrar' para confirmar"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="border-destructive/50 focus-visible:ring-destructive"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteOrders}
              disabled={isDeleting || deleteConfirmText.toLowerCase() !== 'borrar'}
              className="gap-2"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Eliminar Órdenes
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
