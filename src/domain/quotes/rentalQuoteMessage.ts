export interface RentalQuoteSnapshot {
  templateVersion: number;
  customerName: string;
  equipment: string;
  startDate: string | null;
  endDate: string | null;
  fulfillment: string | null;
  amount: number;
  currency: string;
  recipient: string;
}
export const quoteEmailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
export const validQuoteEmail = (email: string) => email.length <= 254 && quoteEmailPattern.test(email);
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const date = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : 'To be confirmed';
export function rentalQuoteMessage(quote: RentalQuoteSnapshot) {
  const subject = `Urban Cowboy Rentals quote for ${quote.equipment.replace(/[\r\n]+/g, ' ').trim()}`;
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(quote.amount);
  const rows = [
    ['Equipment', quote.equipment],
    ['Rental dates', `${date(quote.startDate)} to ${date(quote.endDate)}`],
    ['Pickup or delivery', quote.fulfillment || 'To be confirmed'],
    ['Quoted amount', `${amount} USD`],
  ];
  const greeting = `Hi ${quote.customerName},`;
  const introduction = 'Thanks for your rental request. Here’s your quote from Urban Cowboy Rentals.';
  const next = 'Reply with any questions or to discuss next steps. Your rental is subject to confirmation.';
  return {
    subject,
    text: [greeting, '', introduction, '', ...rows.map(([label, value]) => `${label}: ${value}`), '', next, '', 'Urban Cowboy Rentals'].join('\n'),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f2ed;color:#231c14;font-family:Arial,sans-serif"><div style="max-width:600px;margin:24px auto;background:#fff;padding:28px;border-top:6px solid #f4b000"><p style="font-weight:bold">URBAN COWBOY RENTALS</p><h1 style="font-size:26px">Your rental quote</h1><p>${escape(greeting)}</p><p>${escape(introduction)}</p><table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:12px 4px;border-bottom:1px solid #ddd;vertical-align:top">${escape(label)}</td><td style="padding:12px 4px;border-bottom:1px solid #ddd;font-weight:bold;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join('')}</table><p style="line-height:1.6">${escape(next)}</p><p>Urban Cowboy Rentals<br><a href="https://www.urbancowboyrentals.com">urbancowboyrentals.com</a></p></div></body></html>`,
  };
}
