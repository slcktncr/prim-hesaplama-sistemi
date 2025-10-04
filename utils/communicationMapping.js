// İletişim türleri mapping sistemi
// Eski hardcoded alanları yeni dinamik türlere map eder

const LEGACY_COMMUNICATION_FIELDS = {
  whatsappIncoming: 'WHATSAPP_INCOMING',
  callIncoming: 'CALL_INCOMING', 
  callOutgoing: 'CALL_OUTGOING',
  meetingNewCustomer: 'MEETING_NEW_CUSTOMER',
  meetingAfterSale: 'MEETING_AFTER_SALE'
};

const LEGACY_FIELD_NAMES = {
  whatsappIncoming: 'WhatsApp Gelen',
  callIncoming: 'Gelen Arama',
  callOutgoing: 'Giden Arama', 
  meetingNewCustomer: 'Yeni Müşteri',
  meetingAfterSale: 'Satış Sonrası'
};

const LEGACY_FIELD_COLORS = {
  whatsappIncoming: '#28a745',
  callIncoming: '#007bff',
  callOutgoing: '#ffc107',
  meetingNewCustomer: '#17a2b8',
  meetingAfterSale: '#6c757d'
};

// Eski veriyi yeni formata çevir
const mapLegacyToDynamic = (legacyData, communicationTypes = []) => {
  const dynamicData = {};
  
  // Önce yeni türlerden gelen verileri kopyala
  communicationTypes.forEach(type => {
    dynamicData[type.code] = legacyData[type.code] || 0;
  });
  
  // Eski alanları yeni türlere map et
  Object.keys(LEGACY_COMMUNICATION_FIELDS).forEach(legacyField => {
    const newCode = LEGACY_COMMUNICATION_FIELDS[legacyField];
    if (legacyData[legacyField] && !dynamicData[newCode]) {
      dynamicData[newCode] = legacyData[legacyField];
    }
  });
  
  return dynamicData;
};

// Yeni veriyi eski formata çevir (geriye uyumluluk için)
const mapDynamicToLegacy = (dynamicData) => {
  const legacyData = {};
  
  Object.keys(LEGACY_COMMUNICATION_FIELDS).forEach(legacyField => {
    const newCode = LEGACY_COMMUNICATION_FIELDS[legacyField];
    legacyData[legacyField] = dynamicData[newCode] || 0;
  });
  
  return legacyData;
};

// Toplam iletişim hesapla (hem eski hem yeni)
const calculateTotalCommunication = (data, communicationTypes = []) => {
  let total = 0;
  
  // Yeni türlerden hesapla
  communicationTypes.forEach(type => {
    total += data[type.code] || 0;
  });
  
  // Eski alanlardan hesapla (fallback)
  if (total === 0) {
    Object.keys(LEGACY_COMMUNICATION_FIELDS).forEach(legacyField => {
      total += data[legacyField] || 0;
    });
  }
  
  return total;
};

// Rapor için dinamik tür listesi oluştur
const getReportTypes = (communicationTypes = []) => {
  // Eğer yeni türler varsa onları kullan
  if (communicationTypes.length > 0) {
    return communicationTypes.map(type => ({
      code: type.code,
      name: type.name,
      color: type.color,
      category: type.category
    }));
  }
  
  // Yoksa eski türleri kullan
  return Object.keys(LEGACY_COMMUNICATION_FIELDS).map(legacyField => ({
    code: LEGACY_COMMUNICATION_FIELDS[legacyField],
    name: LEGACY_FIELD_NAMES[legacyField],
    color: LEGACY_FIELD_COLORS[legacyField],
    category: legacyField.includes('meeting') ? 'meeting' : 
              legacyField.includes('Incoming') ? 'incoming' : 'outgoing'
  }));
};

module.exports = {
  LEGACY_COMMUNICATION_FIELDS,
  LEGACY_FIELD_NAMES,
  LEGACY_FIELD_COLORS,
  mapLegacyToDynamic,
  mapDynamicToLegacy,
  calculateTotalCommunication,
  getReportTypes
};
