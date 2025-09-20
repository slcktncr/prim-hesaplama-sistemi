# Render Deployment Kılavuzu

Bu kılavuz, Prim Hesaplama Sistemi'ni Render platformunda deploy etmek için hazırlanmıştır.

## 🚀 Deployment Adımları

### 1. Render Dashboard'a Gidin
- [render.com](https://render.com) adresine gidin
- GitHub hesabınızla giriş yapın

### 2. Yeni Web Service Oluşturun
- "New +" → "Web Service" seçin
- GitHub repository'nizi seçin
- Branch: `main` (veya deploy etmek istediğiniz branch)

### 3. Build & Deploy Ayarları

#### Build Settings:
- **Build Command**: `npm install && npm run render-postbuild`
- **Start Command**: `npm start`
- **Node Version**: `20.x`

#### Advanced Settings:
- **Auto-Deploy**: `Yes`
- **Health Check Path**: `/api/health`

### 4. Environment Variables

Aşağıdaki environment variables'ları Render dashboard'da ayarlayın:

#### Zorunlu Variables:
```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-super-secret-jwt-key-here
```

#### Opsiyonel Variables:
```
FRONTEND_URL=https://your-app-name.onrender.com
BACKEND_URL=https://your-app-name.onrender.com
```

### 5. MongoDB Atlas Kurulumu

#### MongoDB Atlas'ta:
1. Cluster oluşturun (ücretsiz M0)
2. Database user oluşturun
3. Network Access'te IP whitelist'e `0.0.0.0/0` ekleyin (Render için)
4. Connection string'i kopyalayın

#### Connection String Formatı:
```
mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
```

## 📋 Deployment Checklist

### ✅ Hazırlık:
- [ ] GitHub repository'si hazır
- [ ] MongoDB Atlas cluster'ı oluşturuldu
- [ ] Environment variables belirlendi
- [ ] JWT secret key oluşturuldu

### ✅ Render Ayarları:
- [ ] Web service oluşturuldu
- [ ] Build command: `npm install && npm run render-postbuild`
- [ ] Start command: `npm start`
- [ ] Environment variables eklendi
- [ ] Health check path: `/api/health`

### ✅ Test:
- [ ] Deployment başarılı
- [ ] Health check çalışıyor: `https://your-app.onrender.com/api/health`
- [ ] Frontend yükleniyor
- [ ] Login çalışıyor
- [ ] Database bağlantısı çalışıyor

## 🔧 Sorun Giderme

### Build Hatası:
```bash
# Logs'ta şu hatayı görürseniz:
"Module not found"
# Çözüm: package.json'da dependency eksik olabilir
```

### Database Bağlantı Hatası:
```bash
# MongoDB Atlas'ta:
1. Network Access → IP Whitelist → 0.0.0.0/0 ekleyin
2. Database Access → User permissions kontrol edin
3. Connection string'de şifre doğru mu kontrol edin
```

### Environment Variables:
```bash
# Render Dashboard → Environment → Add Environment Variable
# Her variable'ı tek tek ekleyin
```

## 📊 İptal Import Özelliği

Yeni eklenen İptal Import özelliği deployment'ta otomatik olarak çalışacak:

- ✅ Backend route'ları hazır
- ✅ Frontend component'i hazır  
- ✅ Excel şablonu sistemi hazır
- ✅ API endpoints hazır

### Test Etmek İçin:
1. `https://your-app.onrender.com` adresine gidin
2. Admin hesabıyla giriş yapın
3. Sistem Ayarları → İptal Import sekmesine gidin
4. Excel şablonunu indirin ve test edin

## 🔒 Güvenlik

### JWT Secret:
```bash
# Güçlü bir JWT secret oluşturun:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### MongoDB:
- Atlas'ta güçlü şifre kullanın
- Database user'a minimum gerekli yetkiler verin
- Regular backup'lar alın

## 📈 Monitoring

### Render Dashboard:
- Deployment logs
- Runtime logs  
- Metrics
- Health checks

### Health Check:
```
GET https://your-app.onrender.com/api/health
Response: {"status":"OK","timestamp":"...","service":"Prim Hesaplama Sistemi"}
```

## 🚀 Deployment Sonrası

### İlk Kurulum:
1. Admin kullanıcısı oluşturun
2. Roller ve yetkiler ayarlayın
3. Prim dönemleri oluşturun
4. Satış türleri ayarlayın

### İptal Import Test:
1. Sistem Ayarları → İptal Import
2. Şablon indirin
3. Test verisi girin
4. Import işlemini test edin

---

**Not**: Render'da free plan kullanıyorsanız, 15 dakika inaktivite sonrası uygulama uyku moduna geçer. İlk erişimde 30-60 saniye yükleme süresi normal.
