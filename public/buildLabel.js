// Shared label builder.
// Loaded as a plain <script> in the browser; also importable in Node for tests
// (see the conditional export at the bottom of this file).
function buildLabel(item, qr, size) {
  // Load card config for this size (falls back to defaults)
  const saved = JSON.parse(localStorage.getItem('kanban_card_configs')||'{}');
  const DEFAULTS_LOCAL = {
    xs:{showDescription:true,showSku:true,showPhoto:true,showQr:true,showCellLocation:true,cellLocationFontSize:7,descFontSize:8,skuFontSize:7,qrSize:52},
    sm:{showToolNum:true,showSku:true,showDescription:true,showVendor:false,showBin:false,showQr:true,headerBg:'#1a1916',toolNumFontSize:24,descFontSize:8,skuFontSize:7,vendorFontSize:6,dividerWeight:2,qrSize:62,leftColWidth:54},
    md:{showHeader:true,showCellLabel:true,showToolNum:true,showSku:true,showDescription:true,showVendor:true,showReorderQty:true,showQr:true,showPhoto:true,headerBg:'#1a1916',cellLabelFontSize:9,locationFontSize:12,toolNumFontSize:10,skuFontSize:9,descFontSize:14,vendorFontSize:8,qtyFontSize:14,qtyLabelSize:6,qtyBorderWeight:1.5,qrSize:72,headerHeight:26},
    lg:{showHeader:true,showCellLabel:true,showToolNum:true,showSku:true,showDescription:true,showVendor:true,showReorderQty:true,showPhoto:true,showQr:true,headerBg:'#1a1916',cellLabelFontSize:11,locationFontSize:15,toolNumFontSize:13,descFontSize:18,skuFontSize:12,vendorFontSize:10,qtyFontSize:16,qtyLabelSize:7,qtyBorderWeight:1.5,qrSize:112,headerHeight:32,padding:14},
    full:{showHeader:true,showCellLabel:true,showToolNum:true,showSku:true,showDescription:true,showVendorBox:true,showLocationBox:true,showReorderQtyBox:true,showPhoto:true,showQr:true,headerBg:'#1a1916',cellLabelFontSize:14,locationFontSize:13,toolNumFontSize:11,descFontSize:18,skuFontSize:11,infoFontSize:11,locationBoxFontSize:13,qtyFontSize:20,qtyLabelSize:7,qrSize:140,headerHeight:36,padding:14,photoHeight:110},
    ship:{showHeader:true,showCellLabel:true,showToolNum:true,showDescription:true,showSku:true,showVendor:true,showLocation:true,showReorderQty:true,showQr:true,showPhoto:true,descFontSize:34,skuFontSize:14,locationFontSize:26,qtyFontSize:34,qtyLabelSize:10,qrSize:150,headerHeight:46,padding:18}
  };
  const c = Object.assign({}, DEFAULTS_LOCAL[size]||{}, saved[size]||{});
  const shopName = ((settings.shopName||'YOUR SHOP')).toUpperCase();
  const _s = JSON.parse(localStorage.getItem('kanban_settings')||'{}');
  const shopLogo = _s.shopLogo || null;

  const tMatch = item.description && item.description.match(/^(T\d+)\s*[-–]?\s*/i);
  const toolNum = tMatch ? tMatch[1].toUpperCase() : null;
  const descRest = tMatch ? item.description.slice(tMatch[0].length) : item.description;

  // Category / Cell label
  let catLabel = '';
  if (cats && item.category) {
    if (cats[item.category]) {
      catLabel = cats[item.category].label;
    } else {
      // item.category is a subtype color — resolve to parent cell label
      for (const cell of Object.values(cats)) {
        if (cell.subtypes && cell.subtypes[item.category] !== undefined) {
          catLabel = cell.label;
          break;
        }
      }
    }
  }

  // Category field directly sets header color; fallback to card editor default
  const typeColor = item.category || null;
  const hbg = (size !== 'sm' && typeColor) ? typeColor : (c.headerBg || '#1a1916');
  function isLight(hex) {
    try { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128; } catch { return false; }
  }
  const fontFamilies = {'mono':"'IBM Plex Mono',monospace",'sans':"'IBM Plex Sans',sans-serif",'serif':"Georgia,serif"};
  const hdrFont = fontFamilies[c.headerFontFamily||'mono'] || fontFamilies['mono'];
  const hdrFontSize = c.headerFontSize;
  const hdrFontWeight = c.headerFontWeight || 500;
  const htext = isLight(hbg) ? '#1a1916' : '#ffffff';
  const hTextMuted = isLight(hbg) ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.5)';

  // ── SHIP — Shipping Label 4"×6" (384×576px) — BLACK & WHITE, for the shipping-label
  //    printer; a high-contrast sticker for labeling larger items. Ignores category color. ──
  if (size==='ship') {
    const qs = c.qrSize || 150;
    const pad = c.padding || 18;
    return `
    <div style="width:384px;height:576px;background:#fff;color:#000;border:3px solid #000;font-family:'IBM Plex Mono',monospace;display:flex;flex-direction:column;overflow:hidden">
      ${c.showHeader!==false?`
      <div style="background:#000;color:#fff;height:${c.headerHeight||46}px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 ${pad}px;gap:10px;overflow:hidden">
        ${shopLogo?`<img src="${esc(shopLogo)}" style="max-height:${(c.headerHeight||46)-14}px;max-width:150px;object-fit:contain;filter:brightness(0) invert(1)" onerror="this.style.display='none'">`
          :`<span style="font-size:13px;font-weight:700;letter-spacing:.14em">${esc(shopName)}</span>`}
        <span style="font-size:10px;font-weight:600;letter-spacing:.18em;opacity:.85">SHIPPING LABEL</span>
      </div>`:''}
      ${c.showCellLabel!==false&&catLabel?`
      <div style="border-bottom:2px solid #000;padding:5px ${pad}px;flex-shrink:0">
        <span style="font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">${esc(catLabel)}</span>
      </div>`:''}
      <div style="padding:${pad}px ${pad}px 10px;flex-shrink:0">
        ${c.showToolNum!==false&&toolNum?`<div style="font-size:16px;font-weight:700;letter-spacing:.08em;margin-bottom:4px">${esc(toolNum)}</div>`:''}
        ${c.showDescription!==false?`<div style="font-size:${c.descFontSize||34}px;font-weight:800;font-family:'IBM Plex Sans',sans-serif;line-height:1.08;letter-spacing:-.01em;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">${esc(descRest||item.description)}</div>`:''}
        ${(c.showSku!==false&&item.sku)||(c.showVendor!==false&&item.supplier)?`<div style="font-size:${c.skuFontSize||14}px;font-weight:600;margin-top:8px;letter-spacing:.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc([item.supplier,item.sku].filter(Boolean).join('   ·   '))}</div>`:''}
      </div>
      ${c.showLocation!==false&&item.bin?`
      <div style="margin:0 ${pad}px;border:2px solid #000;display:flex;align-items:stretch;flex-shrink:0">
        <div style="background:#000;color:#fff;display:flex;align-items:center;padding:0 11px;font-size:9px;font-weight:700;letter-spacing:.12em">LOCATION</div>
        <div style="flex:1;display:flex;align-items:center;padding:6px 12px;font-size:${c.locationFontSize||26}px;font-weight:800;letter-spacing:.01em;line-height:1.05;word-break:break-word;overflow:hidden">${esc(item.bin)}</div>
      </div>`:''}
      ${c.showReorderQty!==false?`
      <div style="display:flex;gap:10px;margin:12px ${pad}px 0;flex-shrink:0">
        <div style="flex:1;border:2px solid #000;padding:8px 6px;text-align:center">
          <div style="font-size:${c.qtyLabelSize||10}px;font-weight:700;letter-spacing:.12em;margin-bottom:3px">MIN STOCK</div>
          <div style="font-size:${c.qtyFontSize||34}px;font-weight:800;line-height:1">${item.minStock||1}${item.minUnit?`<span style="font-size:14px;font-weight:600;margin-left:3px">${esc(item.minUnit)}</span>`:''}</div>
        </div>
        <div style="flex:1;border:2px solid #000;padding:8px 6px;text-align:center">
          <div style="font-size:${c.qtyLabelSize||10}px;font-weight:700;letter-spacing:.12em;margin-bottom:3px">REORDER QTY</div>
          <div style="font-size:${c.qtyFontSize||34}px;font-weight:800;line-height:1">${item.reorderQty||1}${item.reorderUnit?`<span style="font-size:14px;font-weight:600;margin-left:3px">${esc(item.reorderUnit)}</span>`:''}</div>
        </div>
      </div>`:''}
      <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:16px;padding:14px ${pad}px;min-height:0;overflow:hidden">
        ${c.showPhoto!==false&&item.photo?`<img src="${esc(item.photo)}" style="width:118px;height:118px;object-fit:contain;filter:grayscale(1) contrast(1.15);flex-shrink:0">`:''}
        ${c.showQr!==false?`
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <img src="${qr}" style="width:${qs}px;height:${qs}px;border:3px solid #000;padding:5px;display:block">
          <div style="font-size:11px;font-weight:700;letter-spacing:.1em;margin-top:7px">SCAN TO REORDER</div>
        </div>`:''}
      </div>
    </div>`;
  }

  // ── XS — Bin Label 1.5"×1" (144×96px) ───────────────────────────────────────
  if (size==='xs') {
    const qs = c.qrSize || 52;
    const photoH = qs;
    const clfs = c.cellLocationFontSize || 7;
    const stripH = clfs + 7;
    return `
    <div style="width:144px;height:96px;background:#fff;border:1.5px solid #1a1916;font-family:'IBM Plex Mono',monospace;display:flex;flex-direction:column;overflow:hidden">
      ${c.showCellLocation!==false&&(catLabel||item.bin)?`
      <div style="background:${hbg};height:${stripH}px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 5px;gap:3px;overflow:hidden">
        <span style="font-size:${clfs}px;color:${htext};font-weight:700;letter-spacing:.05em;font-family:'IBM Plex Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(catLabel||'')}</span>
        ${item.bin?`<span style="font-size:${clfs}px;color:${htext};font-weight:700;letter-spacing:.04em;font-family:'IBM Plex Mono',monospace;flex-shrink:0;background:rgba(255,255,255,.18);padding:0 4px;border-radius:2px">${esc(item.bin)}</span>`:''}
      </div>`:''}
      <div style="flex:1;padding:3px 6px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;min-height:0">
        ${c.showDescription!==false?`<div style="font-size:${c.descFontSize||8}px;font-weight:700;color:#000;line-height:1.2;font-family:'IBM Plex Sans',sans-serif;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word">${esc(toolNum?descRest:item.description)}</div>`:''}
        ${c.showSku!==false&&item.sku?`<div style="font-size:${c.skuFontSize||7}px;font-weight:600;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${esc(item.sku)}</div>`:''}
      </div>
      <div style="border-top:1px solid #1a1916;display:flex;align-items:stretch;flex-shrink:0;height:${qs+8}px">
        ${c.showPhoto!==false&&item.photo?`
        <div style="flex:1;border-right:1px solid #e8e5df;display:flex;align-items:center;justify-content:center;padding:3px;overflow:hidden">
          <img src="${item.photo}" style="max-width:100%;max-height:${photoH}px;object-fit:contain">
        </div>`:''}
        ${c.showQr!==false?`
        <div style="width:${qs+8}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:3px">
          <img src="${qr}" style="width:${qs}px;height:${qs}px;display:block">
        </div>`:''}
      </div>
    </div>`;
  }

  // ── SM — Tool Card 1.75"×0.75" (168×72px) — LOCKED, DO NOT CHANGE ───────────
  if (size==='sm') {
    const lfs = c.toolNumFontSize || 28;
    const divW = c.dividerWeight || 2;
    const qrImgW = c.qrSize || 62;
    const qrColW = qrImgW + 8;
    return `
    <div class="label-sm-print" style="width:168px;height:72px;background:#fff;display:flex;align-items:stretch;font-family:'IBM Plex Mono',monospace;overflow:hidden">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-start;padding:4px 5px;gap:2px;overflow:hidden">
        ${c.showToolNum!==false&&toolNum?`
        <div style="font-size:${lfs}px;font-weight:700;color:#000;line-height:1;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(toolNum)}</div>`:''}
        ${c.showDescription!==false?`
        <div style="font-size:${c.descFontSize||9}px;font-weight:600;color:#000;line-height:1.25;font-family:'IBM Plex Sans',sans-serif;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word">${esc(toolNum?descRest:item.description)}</div>`:''}
        ${c.showSku!==false&&item.sku?`
        <div style="font-size:8px;color:#000;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${esc(item.sku)}</div>`:''}
        ${c.showVendor!==false&&item.supplier?`
        <div style="font-size:7px;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${esc(item.supplier)}${c.showBin!==false&&item.bin?' · '+esc(item.bin):''}</div>`:''}
      </div>
      ${c.showQr!==false?`
      <div style="width:${qrColW}px;flex-shrink:0;border-left:${divW}px solid #000;display:flex;align-items:center;justify-content:flex-start;padding:4px 4px 4px 3px">
        <img src="${qr}" style="width:${qrImgW}px;height:${qrImgW}px;display:block">
      </div>`:''}
    </div>`;
  }

  // ── MD — Medium 3"×2" (288×192px) ────────────────────────────────────────────
  if (size==='md') {
    const qs = c.qrSize || 72;
    const clfs = c.cellLabelFontSize || 9;
    const lfs = c.locationFontSize || 12;
    return `
    <div style="width:288px;height:192px;background:#fff;border:2px solid #1a1916;font-family:'IBM Plex Mono',monospace;display:flex;flex-direction:column;overflow:hidden">
      ${c.showHeader!==false?`
      <div style="background:${hbg};padding:0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;height:${c.headerHeight||26}px;overflow:hidden">
        ${shopLogo
          ?`<img src="${shopLogo}" style="max-height:${(c.headerHeight||26)-6}px;max-width:80px;object-fit:contain;filter:${isLight(hbg)?'none':'brightness(0) invert(1)'}" onerror="this.style.display='none'">`
          :(c.showCellLabel!==false&&catLabel
            ?`<span style="font-size:${clfs}px;color:${htext};font-weight:700;letter-spacing:.06em;font-family:'IBM Plex Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(catLabel)}</span>`
            :`<span style="font-size:${hdrFontSize||8}px;color:${hTextMuted};letter-spacing:.1em;font-family:${hdrFont};font-weight:${hdrFontWeight}">${shopName}</span>`)}
      </div>`:''}
      ${item.bin?`<div style="background:#f4f2ee;border-bottom:1px solid #e8e5df;padding:2px 10px;display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:7px;letter-spacing:.08em;color:#888;font-family:'IBM Plex Mono',monospace">LOCATION</span>
        <span style="font-size:${lfs}px;font-weight:700;color:#1a1916;font-family:'IBM Plex Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.bin)}</span>
      </div>`:''}
      <div style="flex:1;display:flex;overflow:hidden">
        ${item.photo&&c.showPhoto!==false?`
        <div style="width:108px;flex-shrink:0;border-right:1px solid #e8e5df;display:flex;align-items:center;justify-content:center;padding:6px;background:#fafafa">
          <img src="${item.photo}" style="max-width:96px;max-height:100%;object-fit:contain">
        </div>`:''}
        <div style="flex:1;padding:8px 10px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;overflow:hidden">
          <div>
            ${c.showToolNum!==false&&toolNum?`<div style="font-size:${c.toolNumFontSize||10}px;font-weight:700;color:#888;letter-spacing:.06em;margin-bottom:2px">${esc(toolNum)}</div>`:''}
            ${c.showDescription!==false?`<div style="font-size:${c.descFontSize||14}px;font-weight:700;font-family:'IBM Plex Sans',sans-serif;line-height:1.25;color:#1a1916;word-break:break-word">${esc(descRest||item.description)}</div>`:''}
            ${c.showSku!==false&&item.sku?`<div style="font-size:${c.skuFontSize||9}px;color:#555;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.sku)}</div>`:''}
            ${c.showVendor!==false&&item.supplier?`<div style="font-size:8px;color:#888;font-family:'IBM Plex Sans',sans-serif;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.supplier)}</div>`:''}
          </div>
          <div style="display:flex;align-items:stretch;gap:4px;justify-content:flex-end;padding-right:6px">
            ${c.showReorderQty!==false?`
            <div style="border:${c.qtyBorderWeight||1.5}px solid #1a1916;border-radius:3px;padding:2px 5px;text-align:center;display:flex;flex-direction:column;justify-content:center">
              <div style="font-size:${c.qtyLabelSize||6}px;letter-spacing:.06em;color:#888;font-family:'IBM Plex Mono',monospace">MIN</div>
              <div style="font-size:${c.qtyFontSize||13}px;font-weight:700;color:#1a1916;line-height:1">${item.minStock||1}${item.minUnit?`<span style="font-size:7px;font-weight:400;color:#666;margin-left:1px">${esc(item.minUnit)}</span>`:''}</div>
            </div>
            <div style="border:${c.qtyBorderWeight||1.5}px solid #1a1916;border-radius:3px;padding:2px 5px;text-align:center;display:flex;flex-direction:column;justify-content:center">
              <div style="font-size:${c.qtyLabelSize||6}px;letter-spacing:.06em;color:#888;font-family:'IBM Plex Mono',monospace">ORDER</div>
              <div style="font-size:${c.qtyFontSize||13}px;font-weight:700;color:#1a1916;line-height:1">${item.reorderQty||1}${item.reorderUnit?`<span style="font-size:7px;font-weight:400;color:#666;margin-left:1px">${esc(item.reorderUnit)}</span>`:''}</div>
            </div>`:''}
            ${c.showQr!==false?`
            <div style="display:flex;align-items:center">
              <img src="${qr}" style="width:auto;height:100%;max-height:42px;display:block">
            </div>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── LG — Large 4"×3" (384×288px) ─────────────────────────────────────────────
  if (size==='lg') {
    const qs = c.qrSize || 112;
    const photoSize = item.photo && c.showPhoto!==false ? Math.round(qs * 0.72) : 0;
    const clfs = c.cellLabelFontSize || 11;
    const lfs = c.locationFontSize || 15;
    return `
    <div style="width:384px;height:288px;background:#fff;border:2px solid #1a1916;font-family:'IBM Plex Mono',monospace;display:flex;flex-direction:column;overflow:hidden">
      ${c.showHeader!==false?`
      <div style="background:${hbg};padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;height:${c.headerHeight||32}px;overflow:hidden">
        ${shopLogo
          ?`<img src="${shopLogo}" style="max-height:${(c.headerHeight||32)-8}px;max-width:120px;object-fit:contain;filter:${isLight(hbg)?'none':'brightness(0) invert(1)'}">`
          :(c.showCellLabel!==false&&catLabel
            ?`<span style="font-size:${clfs}px;color:${htext};font-weight:700;letter-spacing:.06em;font-family:'IBM Plex Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(catLabel)}</span>`
            :`<span style="font-size:${hdrFontSize||9}px;color:${hTextMuted};letter-spacing:.1em;font-family:${hdrFont};font-weight:${hdrFontWeight}">${shopName}</span>`)}
      </div>`:''}
      ${item.bin?`<div style="background:#f4f2ee;border-bottom:1px solid #e8e5df;padding:3px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:8px;letter-spacing:.08em;color:#888;font-family:'IBM Plex Mono',monospace">LOCATION</span>
        <span style="font-size:${lfs}px;font-weight:700;color:#1a1916;font-family:'IBM Plex Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.bin)}</span>
      </div>`:''}
      <div style="flex:1;display:flex;overflow:hidden">
        <div style="flex:1;padding:${c.padding||12}px 14px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;overflow:hidden">
          <div>
            ${c.showToolNum!==false&&toolNum?`<div style="font-size:${c.toolNumFontSize||11}px;font-weight:700;color:#000;letter-spacing:.08em;margin-bottom:3px">${esc(toolNum)}</div>`:'' }
            ${c.showDescription!==false?`<div style="font-size:${c.descFontSize||20}px;font-weight:700;font-family:'IBM Plex Sans',sans-serif;line-height:1.15;color:#1a1916;word-break:break-word">${esc(descRest||item.description)}</div>`:''}
            ${c.showSku!==false&&item.sku?`<div style="font-size:${c.skuFontSize||11}px;color:#000;letter-spacing:.04em;margin-top:4px">${esc(item.supplier?item.supplier+' · ':'')}${esc(item.sku)}</div>`:''}
          </div>
          <div>
            ${c.showVendor!==false&&item.supplier&&!item.sku?`<div style="font-size:10px;color:#000;font-family:'IBM Plex Sans',sans-serif;margin-bottom:6px">${esc(item.supplier)}</div>`:''}
            ${c.showReorderQty!==false?`
            <div style="display:flex;gap:6px">
              <div style="flex:1;border:${c.qtyBorderWeight||1.5}px solid #1a1916;border-radius:5px;padding:5px 8px;text-align:center">
                <div style="font-size:${c.qtyLabelSize||7}px;letter-spacing:.09em;color:#000;margin-bottom:2px;font-family:'IBM Plex Mono',monospace">MIN STOCK</div>
                <div style="font-size:${c.qtyFontSize||18}px;font-weight:700;color:#1a1916;line-height:1">${item.minStock||1}${item.minUnit?`<span style="font-size:9px;font-weight:400;color:#666;margin-left:2px">${esc(item.minUnit)}</span>`:''}</div>
              </div>
              <div style="flex:1;border:${c.qtyBorderWeight||1.5}px solid #1a1916;border-radius:5px;padding:5px 8px;text-align:center">
                <div style="font-size:${c.qtyLabelSize||7}px;letter-spacing:.09em;color:#000;margin-bottom:2px;font-family:'IBM Plex Mono',monospace">REORDER QTY</div>
                <div style="font-size:${c.qtyFontSize||18}px;font-weight:700;color:#1a1916;line-height:1">${item.reorderQty||1}${item.reorderUnit?`<span style="font-size:9px;font-weight:400;color:#666;margin-left:2px">${esc(item.reorderUnit)}</span>`:''}</div>
              </div>
            </div>`:''}
          </div>
        </div>
        ${c.showQr!==false?`
        <div style="width:${qs+16}px;flex-shrink:0;border-left:1.5px solid #e8e5df;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px 8px">
          ${c.showPhoto!==false&&item.photo?`<img src="${item.photo}" style="width:${photoSize}px;height:${photoSize}px;object-fit:contain;border:1px solid #eee;border-radius:4px">`:'' }
          <img src="${qr}" style="width:${qs}px;height:${qs}px;border:2px solid #1a1916;padding:3px">
          <div style="font-size:7px;color:#000;letter-spacing:.07em;font-family:'IBM Plex Sans',sans-serif">SCAN TO REORDER</div>
        </div>`:''}
      </div>
    </div>`;
  }

  // ── FULL — Index Card 3"×5" (288×480px) ──────────────────────────────────────
  const qs = c.qrSize || 140;
  const clfs = c.cellLabelFontSize || 9;
  const lfs = c.locationFontSize || 13;
  const lbfs = c.locationBoxFontSize || 13;
  return `
    <div style="width:288px;height:480px;background:#fff;border:2px solid #1a1916;font-family:'IBM Plex Mono',monospace;display:flex;flex-direction:column;overflow:hidden">
      ${c.showHeader!==false?`
      <div style="background:${hbg};padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;height:${c.headerHeight||36}px;overflow:hidden">
        ${shopLogo?`<img src="${shopLogo}" style="max-height:${Math.round((c.headerHeight||36)-10)}px;max-width:80px;object-fit:contain;filter:${isLight(hbg)?'none':'brightness(0) invert(1)'}" onerror="this.style.display='none'">`:``}
        ${c.showCellLabel!==false&&catLabel
          ?`<span style="font-size:${clfs}px;color:${htext};font-weight:700;letter-spacing:.07em;font-family:'IBM Plex Mono',monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${shopLogo?'text-align:right':''} ">${esc(catLabel)}</span>`
          :(!shopLogo?`<span style="font-size:${hdrFontSize||8}px;color:${hTextMuted};letter-spacing:.12em;font-weight:${hdrFontWeight};font-family:${hdrFont}">${shopName} · KANBAN</span>`:``)}
      </div>`:``}
      <div style="flex:1;padding:${c.padding||14}px;display:flex;flex-direction:column;overflow:hidden">
        <div style="margin-bottom:10px">
          ${c.showToolNum!==false&&toolNum?`<div style="font-size:11px;font-weight:700;color:${hbg};letter-spacing:.08em;margin-bottom:3px">${esc(toolNum)}</div>`:''}
          ${c.showDescription!==false?`<div style="font-size:${c.descFontSize||18}px;font-weight:700;font-family:'IBM Plex Sans',sans-serif;line-height:1.2;color:#1a1916;word-break:break-word">${esc(descRest||item.description)}</div>`:''}
          ${c.showSku!==false?`<div style="font-size:${c.skuFontSize||11}px;color:#000;letter-spacing:.05em;margin-top:5px">${esc(item.supplier||'')}${item.supplier&&item.sku?' · ':''}${esc(item.sku||'')}</div>`:''}
        </div>
        <div style="height:1px;background:#e8e5df;margin-bottom:10px;flex-shrink:0"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-family:'IBM Plex Sans',sans-serif;flex-shrink:0">
          ${c.showVendorBox!==false?`<div style="background:#f8f6f2;padding:${c.infoBoxPadding||6}px ${(c.infoBoxPadding||6)+3}px;border-radius:4px"><div style="font-size:${c.infoFontSize?c.infoFontSize-3:7}px;letter-spacing:.08em;color:#888;margin-bottom:2px;font-family:'IBM Plex Mono',monospace">VENDOR</div><div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.supplier||'—')}</div></div>`:'<div></div>'}
          ${c.showLocationBox!==false?`
          <div style="background:#f8f6f2;padding:${c.infoBoxPadding||6}px ${(c.infoBoxPadding||6)+3}px;border-radius:4px">
            <div style="font-size:${c.infoFontSize?c.infoFontSize-3:7}px;letter-spacing:.08em;color:#888;margin-bottom:2px;font-family:'IBM Plex Mono',monospace">LOCATION</div>
            <div style="font-size:${lbfs}px;font-weight:700;color:#1a1916;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'IBM Plex Mono',monospace">${esc(item.bin||'—')}</div>
          </div>`:'<div></div>'}
          ${c.showReorderQtyBox!==false?`
          <div style="grid-column:span 2;border:1.5px solid #1a1916;border-radius:4px;padding:8px 10px;display:flex;align-items:stretch;justify-content:space-around;gap:0">
            <div style="flex:1;text-align:center">
              <div style="font-size:${c.qtyLabelSize||7}px;letter-spacing:.1em;color:#000;margin-bottom:2px;font-family:'IBM Plex Mono',monospace">MIN STOCK</div>
              <div style="font-size:${c.qtyFontSize||20}px;font-weight:700;color:#1a1916;line-height:1">${item.minStock||1}${item.minUnit?`<span style="font-size:9px;font-weight:400;color:#666;margin-left:3px">${esc(item.minUnit)}</span>`:''}</div>
            </div>
            <div style="width:1px;background:#e8e5df;margin:0 8px"></div>
            <div style="flex:1;text-align:center">
              <div style="font-size:${c.qtyLabelSize||7}px;letter-spacing:.1em;color:#000;margin-bottom:2px;font-family:'IBM Plex Mono',monospace">REORDER QTY</div>
              <div style="font-size:${c.qtyFontSize||20}px;font-weight:700;color:#1a1916;line-height:1">${item.reorderQty||1}${item.reorderUnit?`<span style="font-size:9px;font-weight:400;color:#666;margin-left:3px">${esc(item.reorderUnit)}</span>`:''}</div>
            </div>
          </div>`:''}
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 8px;overflow:hidden">
          ${c.showPhoto!==false&&item.photo?`
          <img src="${item.photo}" style="width:${Math.min(qs, c.showQr!==false ? 118 : 248)}px;height:${Math.min(qs, c.showQr!==false ? 118 : 248)}px;object-fit:contain;border:1px solid #e8e5df;border-radius:4px;flex-shrink:0">`:''} 
          ${c.showQr!==false?`
          <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
            <img src="${qr}" style="width:${Math.min(qs, c.showPhoto!==false&&item.photo ? 118 : 248)}px;height:${Math.min(qs, c.showPhoto!==false&&item.photo ? 118 : 248)}px;border:2px solid #1a1916;padding:4px">
            <div style="font-size:7px;color:#000;margin-top:5px;letter-spacing:.08em;font-family:'IBM Plex Sans',sans-serif">SCAN TO REORDER</div>
          </div>`:''}
        </div>
      </div>
    </div>`;
}

// Overlay a "PICKUP" corner flag on a finished label when the item is a
// physical-run (local pickup) restock, so whoever pulls the printed card knows
// to drop it in the physical-reorder bin. Applied as a wrapper around the
// rendered HTML (not inside buildLabel) so one helper covers every size and
// every buildLabel copy across the app. The overlay is absolutely positioned,
// so it never changes the card's printed dimensions.
function pickupWrap(item, html) {
  if (!item || !item.physicalReorder) return html;
  const flag = '<div style="position:absolute;top:0;right:0;background:#b26a00;color:#fff;' +
    "font:800 8px/1.2 'IBM Plex Sans',sans-serif;letter-spacing:.06em;padding:3px 7px;" +
    'border-bottom-left-radius:6px;z-index:5;white-space:nowrap">🏃 PICKUP</div>';
  // Inject the flag INTO the card's own root element (making it the positioning
  // context) instead of wrapping the card. A wrapper element changes how the card
  // sits in the print/preview layout ("whole layout shifted"); this keeps one
  // root in and one root out, so a flagged card lays out identically to a plain one.
  const start = html.indexOf('<div');
  const tagEnd = start < 0 ? -1 : html.indexOf('>', start);
  if (tagEnd < 0) return html;
  const openTag = html.slice(start, tagEnd + 1);
  const withPos = /style\s*=\s*"/.test(openTag)
    ? openTag.replace(/style\s*=\s*"/, 'style="position:relative;')
    : openTag.replace('<div', '<div style="position:relative"');
  return html.slice(0, start) + withPos + flag + html.slice(tagEnd + 1);
}

// Node test hook — no effect in the browser (module is undefined there).
if (typeof module !== 'undefined' && module.exports) module.exports = { buildLabel, pickupWrap };
