import type { CompanySettings } from '@/hooks/useCompanySettings';

interface SparePartUsage {
  id: string;
  quantity: number;
  unit_price: number;
  spare_parts: {
    name: string;
  } | null;
}

interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
}

interface OrderData {
  order_number: string;
  device_brand: string;
  device_model: string;
  device_color?: string | null;
  device_imei?: string | null;
  reported_issue: string;
  aesthetic_notes?: string | null;
  initial_budget: number;
  total_paid: number;
  warranty_days?: number | null;
  created_at: string;
  customers?: {
    name: string;
    phone: string;
    cedula: string;
  } | null;
  technicians?: {
    name: string;
  } | null;
  spare_parts_usage?: SparePartUsage[];
  order_additional_costs?: AdditionalCost[];
}

type PrinterSize = '58mm' | '80mm' | '110mm';

const PRINTER_WIDTHS: Record<PrinterSize, string> = {
  '58mm': '54mm',
  '80mm': '72mm',
  '110mm': '100mm',
};

export function printTicket(
  order: OrderData,
  settings: CompanySettings | undefined,
  type: 'entry' | 'delivery' = 'entry'
) {
  const printerSize = (settings?.printer_size || '80mm') as PrinterSize;
  const ticketWidth = PRINTER_WIDTHS[printerSize] || '72mm';
  
  const companyName = settings?.name || 'Taller Técnico';
  const companyAddress = settings?.address || '';
  const companyPhone = settings?.phone || '';
  const companyRif = settings?.rif || '';
  const termsConditions = settings?.terms_conditions || '';
  const warrantyDays = order.warranty_days || settings?.default_warranty_days || 30;

  // Calculate real totals from spare parts and additional costs
  const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
  const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const orderTotal = order.initial_budget + partsTotal + costsTotal;
  const pendingAmount = orderTotal - order.total_paid;

  const createdDate = new Date(order.created_at).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const logoHtml = settings?.logo_url 
    ? `<img src="${settings.logo_url}" alt="Logo" style="max-width: 60%; max-height: 60px; margin: 0 auto 10px; display: block;" />`
    : '';

  const entryTicketContent = `
    <div class="ticket">
      ${logoHtml}
      <h2>${companyName}</h2>
      ${companyRif ? `<p class="small">RIF: ${companyRif}</p>` : ''}
      ${companyAddress ? `<p class="small">${companyAddress}</p>` : ''}
      ${companyPhone ? `<p class="small">Tel: ${companyPhone}</p>` : ''}
      
      <div class="divider"></div>
      
      <h3>TICKET DE ENTRADA</h3>
      <p class="order-number">${order.order_number}</p>
      <p class="small">${createdDate}</p>
      
      <div class="divider"></div>
      
      <div class="section">
        <p class="label">CLIENTE:</p>
        <p class="value">${order.customers?.name || 'N/A'}</p>
        <p class="small">C.I.: ${order.customers?.cedula || 'N/A'}</p>
        <p class="small">Tel: ${order.customers?.phone || 'N/A'}</p>
      </div>
      
      <div class="divider"></div>
      
      <div class="section">
        <p class="label">EQUIPO:</p>
        <p class="value">${order.device_brand} ${order.device_model}</p>
        ${order.device_color ? `<p class="small">Color: ${order.device_color}</p>` : ''}
        ${order.device_imei ? `<p class="small">IMEI: ${order.device_imei}</p>` : ''}
      </div>
      
      <div class="section">
        <p class="label">FALLA REPORTADA:</p>
        <p class="small">${order.reported_issue}</p>
      </div>
      
      ${order.aesthetic_notes ? `
        <div class="section">
          <p class="label">CONDICIÓN ESTÉTICA:</p>
          <p class="small">${order.aesthetic_notes}</p>
        </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div class="section">
        <p class="label">TOTAL:</p>
        <p class="value price">$${orderTotal.toFixed(2)}</p>
        <p class="small">Pagado: $${order.total_paid.toFixed(2)}</p>
        <p class="small">Pendiente: $${pendingAmount.toFixed(2)}</p>
      </div>
      
      <div class="divider"></div>
      
      <div class="terms">
        <p class="label">TÉRMINOS Y CONDICIONES:</p>
        <p class="small">${termsConditions.replace(/\n/g, '<br/>')}</p>
      </div>
      
      <div class="divider"></div>
      
      <p class="small center">Garantía: ${warrantyDays} días a partir de la entrega</p>
      <p class="small center">Conserve este ticket para retirar su equipo</p>
    </div>
  `;

  const deliveryTicketContent = `
    <div class="ticket">
      ${logoHtml}
      <h2>${companyName}</h2>
      ${companyRif ? `<p class="small">RIF: ${companyRif}</p>` : ''}
      ${companyAddress ? `<p class="small">${companyAddress}</p>` : ''}
      ${companyPhone ? `<p class="small">Tel: ${companyPhone}</p>` : ''}
      
      <div class="divider"></div>
      
      <h3>TICKET DE ENTREGA</h3>
      <p class="order-number">${order.order_number}</p>
      <p class="small">${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</p>
      
      <div class="divider"></div>
      
      <div class="section">
        <p class="label">CLIENTE:</p>
        <p class="value">${order.customers?.name || 'N/A'}</p>
      </div>
      
      <div class="section">
        <p class="label">EQUIPO:</p>
        <p class="value">${order.device_brand} ${order.device_model}</p>
      </div>
      
      <div class="section">
        <p class="label">REPARACIÓN REALIZADA:</p>
        <p class="small">${order.reported_issue}</p>
      </div>
      
      ${order.technicians?.name ? `
        <div class="section">
          <p class="label">TÉCNICO:</p>
          <p class="small">${order.technicians.name}</p>
        </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div class="section">
        <p class="label">TOTAL:</p>
        <p class="value price">$${orderTotal.toFixed(2)}</p>
        <p class="small">Pagado: $${orderTotal.toFixed(2)}</p>
      </div>
      
      <div class="divider"></div>
      
      <p class="small center">GARANTÍA: ${warrantyDays} DÍAS</p>
      <p class="small center">Válida desde: ${new Date().toLocaleDateString('es-ES')}</p>
      <p class="small center">Hasta: ${new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')}</p>
      
      <div class="divider"></div>
      
      <p class="small center">¡Gracias por su confianza!</p>
    </div>
  `;

  const ticketContent = type === 'entry' ? entryTicketContent : deliveryTicketContent;

  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket - ${order.order_number}</title>
        <style>
          @page {
            size: ${ticketWidth} auto;
            margin: 0;
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.3;
            background: #fff;
            color: #000;
          }
          
          .ticket {
            width: ${ticketWidth};
            padding: 10px;
            margin: 0 auto;
          }
          
          h2 {
            font-size: 14px;
            text-align: center;
            margin-bottom: 5px;
            font-weight: bold;
          }
          
          h3 {
            font-size: 13px;
            text-align: center;
            margin-bottom: 5px;
            font-weight: bold;
          }
          
          .order-number {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
          }
          
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          
          .section {
            margin-bottom: 8px;
          }
          
          .label {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 2px;
          }
          
          .value {
            font-size: 12px;
          }
          
          .price {
            font-size: 14px;
            font-weight: bold;
          }
          
          .small {
            font-size: 10px;
          }
          
          .center {
            text-align: center;
          }
          
          .terms {
            margin-bottom: 8px;
          }
          
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${ticketContent}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}
