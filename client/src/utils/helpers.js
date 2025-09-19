import moment from 'moment';
import 'moment/locale/tr';

// Moment'i Türkçe olarak ayarla
moment.locale('tr');

// Para formatı
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  }).format(amount || 0);
};

// Kısaltmalı para formatı (grafiklerde kullanım için)
export const formatCurrencyCompact = (amount) => {
  if (!amount) return '₺0';
  
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1000000000) {
    return `₺${(amount / 1000000000).toFixed(1)}B`;
  } else if (absAmount >= 1000000) {
    return `₺${(amount / 1000000).toFixed(1)}M`;
  } else if (absAmount >= 1000) {
    return `₺${(amount / 1000).toFixed(1)}K`;
  } else {
    return `₺${amount.toFixed(0)}`;
  }
};

// Sayı formatı
export const formatNumber = (number) => {
  return new Intl.NumberFormat('tr-TR').format(number || 0);
};

// Kısaltmalı sayı formatı (grafiklerde kullanım için)
export const formatNumberCompact = (number) => {
  if (!number) return '0';
  
  const absNumber = Math.abs(number);
  
  if (absNumber >= 1000000000) {
    return `${(number / 1000000000).toFixed(1)}B`;
  } else if (absNumber >= 1000000) {
    return `${(number / 1000000).toFixed(1)}M`;
  } else if (absNumber >= 1000) {
    return `${(number / 1000).toFixed(1)}K`;
  } else {
    return `${number}`;
  }
};

// Tarih formatı
export const formatDate = (date, format = 'DD.MM.YYYY') => {
  return moment(date).format(format);
};

// Tarih ve saat formatı
export const formatDateTime = (date) => {
  return moment(date).format('DD.MM.YYYY HH:mm');
};

// Relatif tarih
export const formatRelativeTime = (date) => {
  return moment(date).fromNow();
};

// Prim durumu badge class'ı
export const getPrimStatusBadgeClass = (status) => {
  switch (status) {
    case 'ödendi':
      return 'success';
    case 'ödenmedi':
      return 'warning';
    default:
      return 'secondary';
  }
};

// Satış durumu badge class'ı
export const getSaleStatusBadgeClass = (status) => {
  switch (status) {
    case 'aktif':
      return 'success';
    case 'iptal':
      return 'danger';
    default:
      return 'secondary';
  }
};

// İşlem tipi badge class'ı
export const getTransactionTypeBadgeClass = (type) => {
  switch (type) {
    case 'kazanç':
      return 'success';
    case 'kesinti':
      return 'danger';
    case 'transfer_gelen':
      return 'info';
    case 'transfer_giden':
      return 'warning';
    default:
      return 'secondary';
  }
};

// İşlem tipi Türkçe açıklama
export const getTransactionTypeText = (type) => {
  switch (type) {
    case 'kazanç':
      return 'Kazanç';
    case 'kesinti':
      return 'Kesinti';
    case 'transfer_gelen':
      return 'Transfer (Gelen)';
    case 'transfer_giden':
      return 'Transfer (Giden)';
    default:
      return 'Bilinmeyen';
  }
};

// Ödeme tipi renk class'ı
export const getPaymentTypeClass = (paymentType) => {
  switch (paymentType) {
    case 'Nakit':
      return 'success';
    case 'Kredi':
      return 'info';
    case 'Taksit':
      return 'warning';
    case 'Diğer':
      return 'secondary';
    default:
      return 'secondary';
  }
};

// Form validasyonu
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validateRequired = (value) => {
  return value && value.toString().trim().length > 0;
};

export const validateMinLength = (value, minLength) => {
  return value && value.toString().length >= minLength;
};

export const validatePositiveNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
};

// Dosya boyutu formatı
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Yüzde formatı
export const formatPercentage = (value, decimals = 2) => {
  return `%${(value * 100).toFixed(decimals)}`;
};

// Ay adları
export const monthNames = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Dönem adı oluştur
export const createPeriodName = (month, year) => {
  return `${monthNames[month - 1]} ${year}`;
};

// Debounce function
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Satış türü ismine göre value mapping - Frontend ve Backend arasında tutarlılık için
export const getSaleTypeValue = (name) => {
  if (!name) return 'satis';
  
  const lowerName = name.toLowerCase().trim();
  
  // Kapora türleri
  if (lowerName.includes('kapora')) {
    return 'kapora';
  }
  
  // ÖNCE özel türleri kontrol et (daha spesifik olanlar)
  if (lowerName.includes('manuel')) {
    return 'manuel';
  }
  
  // Sonra genel satış türleri (daha genel olanlar)
  if (lowerName.includes('normal') || lowerName.includes('satış') || lowerName.includes('satis')) {
    return 'satis';
  }
  
  // Diğer yeni türler için clean value oluştur
  return lowerName
    .replace(/\s+/g, '') // Boşlukları kaldır
    .replace(/[^\w]/g, '') // Özel karakterleri kaldır
    .substring(0, 20); // Maksimum 20 karakter
};

// Bugünün tarihini YYYY-MM-DD formatında döndürür
export const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Belirtilen gün kadar önceki tarihi YYYY-MM-DD formatında döndürür
export const getDateStringDaysAgo = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

// Quick date filter helpers
export const getQuickDateFilters = (currentFilters = {}) => {
  const today = new Date();
  
  return {
    yesterday: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        ...currentFilters,
        startDate: yesterday.toISOString().split('T')[0],
        endDate: yesterday.toISOString().split('T')[0],
        selectedUser: 'all'
      };
    },
    
    thisMonth: () => {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      console.log('🔍 Bu Ay filter debug:', {
        today: today.toISOString().split('T')[0],
        todayDate: today,
        year: today.getFullYear(),
        month: today.getMonth(), // 0-based: 0=Ocak, 8=Eylül
        monthName: today.toLocaleString('tr-TR', { month: 'long' }),
        firstDayOfMonth: firstDayOfMonth.toISOString().split('T')[0],
        firstDayOfMonthDate: firstDayOfMonth,
        lastDayOfMonth: lastDayOfMonth.toISOString().split('T')[0],
        lastDayOfMonthDate: lastDayOfMonth,
        currentFilters: currentFilters
      });
      
      return {
        ...currentFilters,
        startDate: firstDayOfMonth.toISOString().split('T')[0],
        endDate: lastDayOfMonth.toISOString().split('T')[0],
        selectedUser: 'all'
      };
    },
    
    lastMonth: () => {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        ...currentFilters,
        startDate: lastMonth.toISOString().split('T')[0],
        endDate: lastDayOfLastMonth.toISOString().split('T')[0],
        selectedUser: 'all'
      };
    },
    
    thisYear: () => {
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      return {
        ...currentFilters,
        startDate: firstDayOfYear.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        selectedUser: 'all'
      };
    }
  };
};

// Quick date filter buttons component helper
export const QuickDateButtons = ({ filters, setFilters, size = "sm", className = "" }) => {
  const quickFilters = getQuickDateFilters(filters);
  
  return (
    <div className={`d-flex gap-2 ${className}`}>
      <button 
        className="btn btn-outline-primary"
        style={{ fontSize: size === "sm" ? "0.875rem" : "1rem" }}
        onClick={() => setFilters(quickFilters.yesterday())}
      >
        Dün
      </button>
      <button 
        className="btn btn-outline-primary"
        style={{ fontSize: size === "sm" ? "0.875rem" : "1rem" }}
        onClick={() => setFilters(quickFilters.thisMonth())}
      >
        Bu Ay
      </button>
      <button 
        className="btn btn-outline-primary"
        style={{ fontSize: size === "sm" ? "0.875rem" : "1rem" }}
        onClick={() => setFilters(quickFilters.lastMonth())}
      >
        Geçen Ay
      </button>
      <button 
        className="btn btn-outline-primary"
        style={{ fontSize: size === "sm" ? "0.875rem" : "1rem" }}
        onClick={() => setFilters(quickFilters.thisYear())}
      >
        Bu Yıl
      </button>
    </div>
  );
};

// Local storage helpers
export const setLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error setting localStorage:', error);
  }
};

export const getLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error getting localStorage:', error);
    return defaultValue;
  }
};

export const removeLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing localStorage:', error);
  }
};

// Kullanıcı yetki kontrolü
export const hasPermission = (user, permission) => {
  if (!user) return false;
  
  // Individual permission override varsa onu kullan
  if (user.individualPermissions && user.individualPermissions[permission] !== null && user.individualPermissions[permission] !== undefined) {
    return !!user.individualPermissions[permission];
  }
  
  // Yoksa rol yetkisini kullan
  if (user.role && user.role.permissions) {
    return !!user.role.permissions[permission];
  }
  
  return false;
};

// Birden fazla yetki kontrolü (herhangi biri yeterli) - Tek sistem
export const hasAnyPermission = (user, permissions) => {
  if (!user || !Array.isArray(permissions)) return false;
  
  return permissions.some(permission => hasPermission(user, permission));
};

// Kullanıcının etkili rolünü döndürür - Tek sistem
export const getUserEffectiveRole = (user) => {
  if (!user) return null;
  
  // Tanımlı rol
  if (user.role) {
    return {
      name: user.role.name,
      displayName: user.role.displayName || user.role.name,
      isSystemRole: user.role.isSystemRole || false
    };
  }
  
  // Varsayılan
  return {
    name: 'user',
    displayName: 'Kullanıcı',
    isSystemRole: false
  };
};