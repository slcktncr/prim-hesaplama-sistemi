# Satış Import Excel Şablonu

## Gerekli Kolonlar (A-R):

| Kolon | Alan Adı | Açıklama | Örnek | Zorunlu |
|-------|----------|----------|--------|---------|
| A | customerName | Müşteri Adı Soyadı | "Ahmet Yılmaz" | ✅ |
| B | blockNo | Blok No | "A1", "B2" | ✅ |
| C | apartmentNo | Daire No | "12", "34" | ✅ |
| D | periodNo | Dönem No | "1", "2" | ✅ |
| E | saleType | Satış Türü | "satis", "kapora", "yazlik", "kislik" | ✅ |
| F | contractNo | Sözleşme No | "SZL2021001" | ❌ |
| G | saleDate | Satış Tarihi | "2021-03-15" (YYYY-MM-DD) | ✅ |
| H | entryDate | Giriş Tarihi | "2021-06-01" | ✅ |
| I | exitDate | Çıkış Tarihi | "2022-06-01" | ✅ |
| J | listPrice | Liste Fiyatı | 500000 | ✅ |
| K | discountRate | İndirim Oranı | 0, 5, 10 (yüzde) | ❌ |
| L | activitySalePrice | Aktivite Satış Fiyatı | 475000 | ✅ |
| M | primAmount | Prim Tutarı | 4750 | ✅ |
| N | primStatus | Prim Durumu | "ödendi", "ödenmedi" | ✅ |
| O | paymentType | Ödeme Türü | "Nakit", "Kredi" | ❌ |
| P | status | Durum | "aktif", "iptal" | ✅ |
| Q | salesperson | Satış Temsilcisi | "admin" (username) | ✅ |
| R | notes | Notlar | "Geçmiş yıl kaydı" | ❌ |

## Önemli Kurallar:

### 1. Tarih Formatı:
- **YYYY-MM-DD** formatında olmalı (2021-03-15)
- Excel'de tarih olarak formatlanmış olabilir

### 2. Satış Türleri:
- `satis`: Normal satış
- `kapora`: Kapora
- `yazlik`: Yazlık ev
- `kislik`: Kışlık ev

### 3. Prim Durumu:
- `ödendi`: Prim ödenmiş
- `ödenmedi`: Prim ödenmemiş

### 4. Durum:
- `aktif`: Aktif satış
- `iptal`: İptal edilmiş

### 5. Satış Temsilcisi:
- Mevcut kullanıcının **username**'i olmalı
- Yoksa **"admin"** olarak ayarlanır

## Örnek Satır:
```
Ahmet Yılmaz | A1 | 12 | 1 | satis | SZL2021001 | 2021-03-15 | 2021-06-01 | 2022-06-01 | 500000 | 5 | 475000 | 4750 | ödendi | Nakit | aktif | admin | Geçmiş kayıt
```

## Dosya Formatı:
- **.xlsx** veya **.xls** formatında
- İlk satır başlık olmalı
- Boş satırlar otomatik atlanır
- Hatalı satırlar rapor edilir
