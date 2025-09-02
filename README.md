# Prim Hesaplama ve Yönetim Sistemi

Satış temsilcileri için kapsamlı prim hesaplama ve yönetim sistemi.

## Özellikler

### 🏢 Genel Özellikler
- **Kullanıcı Yönetimi**: Admin ve temsilci rolleri ile güvenli giriş sistemi
- **Satış Yönetimi**: Detaylı satış kayıt ve takip sistemi
- **Prim Hesaplama**: Otomatik prim hesaplama ve dönem yönetimi
- **Raporlama**: Kapsamlı analiz ve performans raporları
- **Responsive Tasarım**: Tüm cihazlarda kullanılabilir modern arayüz

### 📊 Satış Yönetimi
- Müşteri bilgileri (Ad soyad, blok/daire, dönem no)
- Satış detayları (Tarih, sözleşme no, fiyat bilgileri)
- Ödeme tipi seçenekleri (Nakit, Kredi, Taksit, Diğer)
- Satış durumu takibi (Aktif/İptal)
- Satış transferi (Admin yetkisiyle)

### 💰 Prim Sistemi
- **Otomatik Hesaplama**: Liste fiyatı ve aktivite fiyatından düşük olanın belirlenen yüzdesi
- **Esnek Prim Oranı**: Admin tarafından değiştirilebilir prim oranları
- **Dönem Yönetimi**: Aylık prim dönemleri ve otomatik atama
- **Prim Durumu**: Ödenen/ödenmemiş prim takibi
- **Kesinti Sistemi**: İptal edilen ödenmiş primlerden otomatik kesinti

### 📈 Raporlama
- **Dashboard**: Genel özet ve istatistikler
- **Satış Özeti**: Detaylı satış analizi ve grafikler
- **Temsilci Performansı**: Karşılaştırmalı performans analizi
- **Dönem Karşılaştırma**: Aylık trend analizi
- **En İyi Performans**: Liderlik tablosu
- **Detaylı Rapor**: Excel export özelliği ile tam detay

### 🔧 Yönetim Özellikleri
- **Admin Paneli**: Tüm sistem ayarları ve kullanıcı yönetimi
- **Prim Oranı Ayarlama**: Dinamik prim oranı güncellemeleri
- **Dönem Oluşturma**: Manuel prim dönemi yönetimi
- **Satış Transferi**: Temsilciler arası satış aktarımı
- **İptal Yönetimi**: Satış iptal ve geri alma işlemleri

## Teknoloji Stack

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **MongoDB**: NoSQL veritabanı
- **Mongoose**: MongoDB object modeling
- **JWT**: Authentication
- **bcryptjs**: Password hashing

### Frontend
- **React**: UI library
- **React Bootstrap**: UI components
- **React Router**: Routing
- **Axios**: HTTP client
- **Recharts**: Data visualization
- **React Toastify**: Notifications
- **Moment.js**: Date handling

## Kurulum

### Gereksinimler
- Node.js (v18+)
- MongoDB Atlas hesabı veya yerel MongoDB
- Git

### Adım 1: Projeyi İndirin
```bash
git clone <repository-url>
cd prim-hesaplama-sistemi
```

### Adım 2: Backend Kurulumu
```bash
# Root dizinde backend bağımlılıklarını yükleyin
npm install
```

### Adım 3: Frontend Kurulumu
```bash
# Client dizininde frontend bağımlılıklarını yükleyin
cd client
npm install
cd ..
```

### Adım 4: Environment Variables
Root dizinde `.env` dosyası oluşturun:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
PORT=5000
```

### Adım 5: Uygulamayı Başlatın

#### Development Mode (Hem backend hem frontend)
```bash
npm run dev
```

#### Sadece Backend
```bash
npm run server
```

#### Sadece Frontend (ayrı terminal)
```bash
cd client
npm start
```

## Deployment (Render.com)

### Adım 1: GitHub Repository
Projeyi GitHub'a push edin.

### Adım 2: Render.com Hesabı
- [Render.com](https://render.com) hesabı oluşturun
- GitHub hesabınızı bağlayın

### Adım 3: Web Service Oluşturun
- "New Web Service" seçin
- GitHub repository'nizi seçin
- Aşağıdaki ayarları yapın:

**Build Settings:**
- **Build Command**: `npm install && cd client && npm install && npm run build`
- **Start Command**: `npm start`

**Environment Variables:**
- `MONGODB_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: Güçlü bir secret key
- `NODE_ENV`: `production`

### Adım 4: Deploy
- "Create Web Service" butonuna tıklayın
- Deploy işlemi otomatik başlayacak

## Kullanım

### İlk Kurulum
1. Uygulamayı açın
2. "Kayıt Ol" sayfasından ilk kullanıcıyı oluşturun (otomatik admin olur)
3. Prim oranını ayarlayın (Admin Paneli > Prim Ayarları)
4. Gerekirse prim dönemlerini oluşturun

### Günlük Kullanım
1. **Temsilci olarak**: Satış ekle, primlerini takip et
2. **Admin olarak**: Tüm satışları yönet, raporları incele, ayarları güncelle

## API Endpoints

### Authentication
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Giriş
- `GET /api/auth/me` - Profil bilgisi

### Sales
- `GET /api/sales` - Satışları listele
- `POST /api/sales` - Yeni satış ekle
- `PUT /api/sales/:id` - Satış güncelle
- `PUT /api/sales/:id/cancel` - Satış iptal et
- `PUT /api/sales/:id/restore` - Satış geri al
- `PUT /api/sales/:id/transfer` - Satış transfer et

### Prims
- `GET /api/prims/rate` - Aktif prim oranı
- `POST /api/prims/rate` - Prim oranı güncelle
- `GET /api/prims/periods` - Prim dönemleri
- `POST /api/prims/periods` - Yeni dönem oluştur
- `GET /api/prims/transactions` - Prim işlemleri
- `GET /api/prims/earnings` - Prim hakedişleri

### Reports
- `GET /api/reports/dashboard` - Dashboard verileri
- `GET /api/reports/sales-summary` - Satış özeti
- `GET /api/reports/salesperson-performance` - Temsilci performansı
- `GET /api/reports/period-comparison` - Dönem karşılaştırma

## Güvenlik

- JWT tabanlı authentication
- Password hashing (bcryptjs)
- Role-based access control
- Input validation
- CORS koruması

## Lisans

Bu proje özel kullanım için geliştirilmiştir.

## Destek

Herhangi bir sorun veya öneriniz için lütfen iletişime geçin.

---

**Geliştirici**: AI Assistant
**Versiyon**: 1.0.0
**Tarih**: 2024
