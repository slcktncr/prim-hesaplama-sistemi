# İptal Edilen Satışları Import Etme Kılavuzu (Minimal Versiyon)

Bu kılavuz, geçmişte gerçekleşen iptal edilen satışları **sadece gerekli alanlarla** sisteme import etmek için hazırlanmıştır.

## 🎯 Yenilikler

✅ **Sadece 17 sütun** (önceki versiyonda 20 sütun vardı)  
✅ **Gereksiz alanlar kaldırıldı** (Giriş/Çıkış Tarihleri, Kapora Tarihi, Aktivite Satış Fiyatı)  
✅ **Basitleştirilmiş sütun isimleri** (Müşteri Adı Soyadı → Müşteri Adı)  
✅ **Daha hızlı import** ve **daha az hata riski**  

## 📊 Minimal Excel Şablonu

### Sütun Listesi (17 adet)

| # | Sütun Adı | Zorunlu | Açıklama | Örnek |
|---|-----------|---------|----------|-------|
| 1 | **Müşteri Adı** | ✅ | Müşterinin tam adı | Ahmet Yılmaz |
| 2 | **Telefon** | ❌ | Telefon numarası | 05551234567 |
| 3 | **Blok** | ✅ | Blok numarası | A |
| 4 | **Daire** | ✅ | Daire numarası | 101 |
| 5 | **Dönem** | ✅ | Dönem bilgisi | 2024-1 |
| 6 | **Satış Türü** | ✅ | satis, kapora, yazlkev, kslkev | satis |
| 7 | **Satış Tarihi** | ✅ | YYYY-MM-DD formatında | 2024-01-15 |
| 8 | **Sözleşme No** | ❌ | Sözleşme numarası | SZL-2024-001 |
| 9 | **Liste Fiyatı** | ⚠️ | Satış türü ≠ kapora ise zorunlu | 500000 |
| 10 | **İndirim %** | ❌ | 0-100 arası | 10 |
| 11 | **Satış Fiyatı** | ⚠️ | Satış türü ≠ kapora ise zorunlu | 450000 |
| 12 | **Ödeme Şekli** | ❌ | nakit, taksit, vs. | nakit |
| 13 | **Prim %** | ❌ | 0-100 arası | 2.5 |
| 14 | **Satış Danışmanı** | ✅ | Sistemde kayıtlı email | satis@firma.com |
| 15 | **İptal Tarihi** | ✅ | YYYY-MM-DD formatında | 2024-02-20 |
| 16 | **İptal Eden** | ✅ | Sistemde kayıtlı email | admin@firma.com |
| 17 | **İptal Sebebi** | ❌ | Açıklama | Müşteri talebi |

## 🚀 Hızlı Başlangıç

### 1. Şablonları Oluşturun
```bash
npm install xlsx
node scripts/create-minimal-template.js
```

Bu komut 3 dosya oluşturacak:
- `iptal_import_ornekli.xlsx` - Örnek verilerle dolu
- `iptal_import_bos.xlsx` - Boş şablon
- `iptal_import_ornekli.csv` - CSV formatı

### 2. Şablonu Doldurun
- **Yeni başlıyorsanız**: `iptal_import_bos.xlsx` kullanın
- **Örnekleri görmek istiyorsanız**: `iptal_import_ornekli.xlsx` açın

### 3. Import Edin
```bash
node scripts/import-cancelled-sales-minimal.js
```

## ⚠️ Önemli Kurallar

### Satış Türüne Göre Zorunlu Alanlar

#### 🔹 Kapora Türü İçin:
- Müşteri Adı, Blok, Daire, Dönem ✅
- Satış Türü = "kapora" ✅
- Satış Tarihi ✅
- Satış Danışmanı ✅
- İptal Tarihi, İptal Eden ✅
- **Liste Fiyatı ve Satış Fiyatı boş bırakılabilir**

#### 🔹 Diğer Satış Türleri İçin:
- Yukarıdaki tüm alanlar +
- **Liste Fiyatı** ✅
- **Satış Fiyatı** ✅

### Veri Formatları
- **Tarihler**: `YYYY-MM-DD` (örn: 2024-01-15)
- **Yüzdeler**: Sadece sayı (örn: 10, 2.5)
- **Fiyatlar**: Sadece sayı (örn: 500000)
- **Email**: Geçerli format (örn: user@domain.com)

## 🔧 Kaldırılan Alanlar

Önceki versiyonda olan ama artık **gerekmeyen** alanlar:

❌ **Kapora Tarihi** - Satış Tarihi kullanılıyor  
❌ **Giriş Tarihi** - İhtiyaç yok  
❌ **Çıkış Tarihi** - İhtiyaç yok  
❌ **Aktivite Satış Fiyatı** - Satış Fiyatı yeterli  
❌ **Orijinal Liste Fiyatı** - Otomatik hesaplanıyor  
❌ **İndirimli Liste Fiyatı** - Otomatik hesaplanıyor  

## 📈 Avantajlar

### ⚡ Daha Hızlı
- %15 daha az sütun
- Daha az veri girişi
- Daha hızlı import

### 🎯 Daha Basit
- Karmaşık alanlar kaldırıldı
- Anlaşılır sütun isimleri
- Daha az hata riski

### 🔒 Daha Güvenli
- Sadece gerekli veriler
- Daha az doğrulama kuralı
- Daha net hata mesajları

## 🚨 Sık Karşılaşılan Hatalar

### "Satış danışmanı bulunamadı"
```
Çözüm: Email adresinin sistemde kayıtlı olduğunu kontrol edin
```

### "Liste Fiyatı sayısal değer olmalıdır"
```
Çözüm: Sadece sayı girin, para birimi eklemeyin
Doğru: 500000
Yanlış: 500.000 TL
```

### "Geçersiz Satış Tarihi formatı"
```
Çözüm: YYYY-MM-DD formatını kullanın
Doğru: 2024-01-15
Yanlış: 15/01/2024
```

## 📞 Test Etme

Import işlemini test etmek için:

1. Örnek şablonu kullanın: `iptal_import_ornekli.xlsx`
2. Test import çalıştırın:
   ```bash
   node scripts/import-cancelled-sales-minimal.js
   ```
3. Sonuçları kontrol edin

## 🔄 Eski Şablondan Geçiş

Eski 20 sütunlu şablonunuz varsa:

1. Yeni minimal şablonu indirin
2. Verilerinizi yeni sütun isimlerine göre kopyalayın
3. Gereksiz sütunları atlayın
4. Yeni import script'ini kullanın

---

**💡 İpucu**: Bu minimal versiyon %90 kullanım senaryosunu karşılar. Özel durumlar için eski detaylı versiyonu kullanabilirsiniz.
