# İptal Edilen Satışları Import Etme Kılavuzu

Bu kılavuz, geçmişte gerçekleşen iptal edilen satışları sisteme import etmek için hazırlanmıştır.

## 📋 Gereksinimler

### Sistem Gereksinimleri
- Node.js (v14 veya üzeri)
- MongoDB bağlantısı
- `xlsx` paketi (`npm install xlsx`)

### Veri Gereksinimleri
- İptal edilen satış verileri Excel formatında
- Kullanıcı email adresleri sistemde mevcut olmalı
- Prim dönemleri tanımlanmış olmalı

## 📊 Excel Şablonu

### Zorunlu Sütunlar

| Sütun Adı | Açıklama | Örnek |
|-----------|----------|-------|
| **Müşteri Adı Soyadı** | Müşterinin tam adı | Ahmet Yılmaz |
| **Telefon** | Telefon numarası (opsiyonel) | 05551234567 |
| **Blok No** | Blok numarası | A |
| **Daire No** | Daire numarası | 101 |
| **Dönem No** | Dönem bilgisi | 2024-1 |
| **Satış Türü** | satis, kapora, yazlkev, kslkev | satis |
| **Satış Tarihi** | YYYY-MM-DD formatında | 2024-01-15 |
| **Kapora Tarihi** | Kapora türü için (YYYY-MM-DD) | 2024-01-10 |
| **Sözleşme No** | Sözleşme numarası | SZL-2024-001 |
| **Liste Fiyatı** | Orijinal liste fiyatı | 500000 |
| **İndirim Oranı** | Yüzde olarak (0-100) | 10 |
| **Aktivite Satış Fiyatı** | Gerçek satış fiyatı | 450000 |
| **Ödeme Tipi** | Ödeme şekli | nakit, taksit |
| **Giriş Tarihi** | GG/AA formatında | 15/06 |
| **Çıkış Tarihi** | GG/AA formatında | 20/08 |
| **Prim Oranı** | Yüzde olarak (0-100) | 2.5 |
| **Satış Danışmanı Email** | Sistemde kayıtlı email | satis@firma.com |
| **İptal Tarihi** | YYYY-MM-DD formatında | 2024-02-20 |
| **İptal Eden Kullanıcı Email** | Sistemde kayıtlı email | admin@firma.com |
| **Notlar** | Açıklama (opsiyonel) | Müşteri talebi üzerine iptal |

### Satış Türüne Göre Zorunlu Alanlar

#### Kapora Türü İçin:
- Müşteri Adı Soyadı ✓
- Blok No, Daire No, Dönem No ✓
- **Kapora Tarihi** ✓
- Satış Danışmanı Email ✓
- İptal Tarihi, İptal Eden Kullanıcı Email ✓

#### Diğer Satış Türleri İçin:
- Yukarıdaki tüm alanlar +
- **Satış Tarihi** ✓
- **Liste Fiyatı** ✓
- **Aktivite Satış Fiyatı** ✓
- **Ödeme Tipi** ✓

## 🚀 Import İşlemi

### 1. Hazırlık
```bash
# Gerekli paketleri yükleyin
npm install xlsx

# Excel şablonlarını oluşturun
node scripts/create-excel-template.js
```

Bu komut 3 farklı şablon dosyası oluşturacak:
- `iptal_satis_ornekli_sablon.xlsx` - Örnek verilerle dolu Excel
- `iptal_satis_bos_sablon.xlsx` - Boş Excel şablonu  
- `iptal_satis_import_sablonu.csv` - CSV formatı

### 2. Excel Dosyasını Hazırlayın
- **Boş şablon** kullanmak için: `iptal_satis_bos_sablon.xlsx` dosyasını açın
- **Örnek verilerle** başlamak için: `iptal_satis_ornekli_sablon.xlsx` dosyasını açın ve örnek verileri silin
- **CSV tercih ederseniz**: `iptal_satis_import_sablonu.csv` dosyasını Excel'de açın
- Kendi verilerinizi girin
- Dosyayı kaydedin

### 3. Import Scriptini Çalıştırın
```bash
# Script dosyasını çalıştırın
node scripts/import-cancelled-sales.js
```

### 4. Sonuçları Kontrol Edin
Script çalıştıktan sonra aşağıdaki bilgileri göreceksiniz:
- ✓ Başarılı kayıt sayısı
- ⚠ Uyarı sayısı
- ✗ Hata sayısı

## ⚠️ Önemli Notlar

### Veri Formatları
- **Tarihler**: Excel'de YYYY-MM-DD formatında olmalı
- **Giriş/Çıkış Tarihleri**: GG/AA formatında (örn: 15/06)
- **Sayısal Değerler**: Ondalık ayracı nokta (.) olmalı
- **Email Adresleri**: Sistemde kayıtlı olmalı

### Veri Doğrulama
Script aşağıdaki kontrolleri yapar:
- Zorunlu alanların dolu olması
- Tarih formatlarının doğru olması
- Sayısal değerlerin geçerli olması
- Email adreslerinin sistemde bulunması
- İndirim ve prim oranlarının 0-100 arasında olması

### Hata Durumları
Aşağıdaki durumlarda import başarısız olur:
- Zorunlu alan boş
- Geçersiz tarih formatı
- Sistemde bulunmayan email adresi
- Geçersiz sayısal değer
- Aynı sözleşme numarasının tekrar kullanılması

## 🔧 Sorun Giderme

### Sık Karşılaşılan Hatalar

#### "Satış danışmanı bulunamadı"
- Email adresinin sistemde kayıtlı olduğunu kontrol edin
- Büyük/küçük harf duyarlılığına dikkat edin

#### "Geçersiz tarih formatı"
- Excel'de tarihleri YYYY-MM-DD formatında girin
- Giriş/çıkış tarihlerini GG/AA formatında girin

#### "Prim dönemi bulunamadı"
- Satış tarihine uygun prim döneminin tanımlı olduğunu kontrol edin
- Bu durumda uyarı verilir ve import devam eder

#### "Sözleşme numarası zaten mevcut"
- Aynı sözleşme numarasının başka bir kayıtta kullanılmadığını kontrol edin
- Gerekirse sözleşme numarasını değiştirin

### MongoDB Bağlantı Hatası
```bash
# .env dosyanızda MongoDB URI'sini kontrol edin
MONGODB_URI=mongodb://localhost:27017/your-database
```

## 📈 Import Sonrası Kontroller

Import işlemi tamamlandıktan sonra:

1. **Veri Kontrolü**: Sisteme giren verileri kontrol edin
2. **Prim Hesaplamaları**: Prim tutarlarının doğru hesaplandığını kontrol edin
3. **İlişkiler**: Satış danışmanı ve prim dönemi ilişkilerini kontrol edin
4. **Durum**: Tüm kayıtların "iptal" durumunda olduğunu kontrol edin

## 🔄 Tekrar Import

Aynı verileri tekrar import etmek isterseniz:
- Önce mevcut kayıtları silin veya
- Script'i duplicate kontrolü ekleyerek güncelleyin

## 📞 Destek

Import işlemi sırasında sorun yaşarsanız:
1. Hata mesajlarını kaydedin
2. Excel dosyasının formatını kontrol edin
3. Sistem yöneticinizle iletişime geçin

---

**Not**: Bu import işlemi geri alınamaz. Import öncesi mutlaka veritabanınızın yedeğini alın.
