const express = require('express');
const mongoose = require('mongoose');
const CommunicationYear = require('../models/CommunicationYear');
const CommunicationRecord = require('../models/CommunicationRecord');
const Sale = require('../models/Sale');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Helper function: Rastgele tarih üretici (ağırlıklı)
function generateRandomDatesForYear(year, totalCount) {
  const dates = [];
  const startDate = new Date(year, 0, 1); // 1 Ocak
  const endDate = new Date(year, 11, 31); // 31 Aralık
  
  // Yıl içindeki toplam gün sayısı
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  // Her güne rastgele ama dengeli dağılım yap
  for (let i = 0; i < totalCount; i++) {
    const randomDay = Math.floor(Math.random() * totalDays);
    const randomDate = new Date(startDate);
    randomDate.setDate(startDate.getDate() + randomDay);
    
    dates.push(new Date(randomDate));
  }
  
  // Tarihleri sırala
  dates.sort((a, b) => a - b);
  return dates;
}

// Helper function: İletişim kayıtları oluştur
async function createCommunicationRecords(userId, userName, year, communicationData) {
  const records = [];
  
  console.log(`Creating communication records for ${userName} (${userId}) - Year ${year}`);
  
  // İletişim verisi yoksa boş array döndür
  if (!communicationData || Object.values(communicationData).every(val => !val || val === 0)) {
    console.log(`No communication data for ${userName}, skipping`);
    return records;
  }
  
  // Her iletişim türü için rastgele tarihler oluştur
  const whatsappDates = generateRandomDatesForYear(year, communicationData.whatsappIncoming || 0);
  const callIncomingDates = generateRandomDatesForYear(year, communicationData.callIncoming || 0);
  const callOutgoingDates = generateRandomDatesForYear(year, communicationData.callOutgoing || 0);
  const meetingNewDates = generateRandomDatesForYear(year, communicationData.meetingNewCustomer || 0);
  const meetingAfterDates = generateRandomDatesForYear(year, communicationData.meetingAfterSale || 0);
  
  // Tüm tarihleri birleştir ve günlük olarak grupla
  const allDates = [
    ...whatsappDates.map(d => ({ date: d, type: 'whatsapp' })),
    ...callIncomingDates.map(d => ({ date: d, type: 'callIncoming' })),
    ...callOutgoingDates.map(d => ({ date: d, type: 'callOutgoing' })),
    ...meetingNewDates.map(d => ({ date: d, type: 'meetingNew' })),
    ...meetingAfterDates.map(d => ({ date: d, type: 'meetingAfter' }))
  ];
  
  // Günlük grupla
  const dailyGroups = new Map();
  allDates.forEach(item => {
    const dateKey = item.date.toISOString().split('T')[0];
    if (!dailyGroups.has(dateKey)) {
      dailyGroups.set(dateKey, {
        date: new Date(item.date),
        whatsappIncoming: 0,
        callIncoming: 0,
        callOutgoing: 0,
        meetingNewCustomer: 0,
        meetingAfterSale: 0
      });
    }
    
    const dayData = dailyGroups.get(dateKey);
    switch (item.type) {
      case 'whatsapp': dayData.whatsappIncoming++; break;
      case 'callIncoming': dayData.callIncoming++; break;
      case 'callOutgoing': dayData.callOutgoing++; break;
      case 'meetingNew': dayData.meetingNewCustomer++; break;
      case 'meetingAfter': dayData.meetingAfterSale++; break;
    }
  });
  
  // Günlük kayıtları oluştur
  for (let [dateKey, dayData] of dailyGroups) {
    const totalCommunication = dayData.whatsappIncoming + dayData.callIncoming + 
                              dayData.callOutgoing + dayData.meetingNewCustomer + dayData.meetingAfterSale;
    
    if (totalCommunication > 0) {
      records.push({
        date: dayData.date,
        year: dayData.date.getFullYear(),
        month: dayData.date.getMonth() + 1,
        day: dayData.date.getDate(),
        salesperson: userId,
        whatsappIncoming: dayData.whatsappIncoming,
        callIncoming: dayData.callIncoming,
        callOutgoing: dayData.callOutgoing,
        meetingNewCustomer: dayData.meetingNewCustomer,
        meetingAfterSale: dayData.meetingAfterSale,
        totalCommunication: totalCommunication,
        isHistoricalMigration: true,
        migratedFrom: 'CommunicationYear',
        migratedAt: new Date()
      });
    }
  }
  
  console.log(`Generated ${records.length} communication records for ${userName}`);
  return records;
}

// Helper function: Satış kayıtları oluştur
async function createSalesRecords(userId, userName, year, salesData) {
  const records = [];
  
  console.log(`Creating sales records for ${userName} (${userId}) - Year ${year}`);
  
  const totalSales = salesData.totalSales || 0;
  const totalCancellations = salesData.cancellations || 0;
  const totalAmount = salesData.totalAmount || 0;
  const totalPrim = salesData.totalPrim || 0;
  const cancellationAmount = salesData.cancellationAmount || 0;
  
  if (totalSales === 0 && totalCancellations === 0) {
    console.log(`No sales data for ${userName}, skipping`);
    return records;
  }
  
  // Aktif satışlar için rastgele tarihler
  const activeSalesDates = generateRandomDatesForYear(year, totalSales);
  const cancelledSalesDates = generateRandomDatesForYear(year, totalCancellations);
  
  // Ortalama tutarları hesapla
  const avgSaleAmount = totalSales > 0 ? totalAmount / totalSales : 0;
  const avgPrimAmount = totalSales > 0 ? totalPrim / totalSales : 0;
  const avgCancellationAmount = totalCancellations > 0 ? cancellationAmount / totalCancellations : 0;
  
  // Aktif satış kayıtları oluştur
  activeSalesDates.forEach((date, index) => {
    records.push({
      customerName: `Geçmiş Müşteri ${index + 1}`,
      blockNo: `B${Math.floor(Math.random() * 10) + 1}`,
      apartmentNo: `${Math.floor(Math.random() * 50) + 1}`,
      periodNo: `${Math.floor(Math.random() * 12) + 1}`,
      saleType: 'satis', // Normal satış
      contractNo: `GCM${year}${String(index + 1).padStart(4, '0')}`,
      saleDate: date,
      entryDate: date,
      exitDate: new Date(date.getTime() + (365 * 24 * 60 * 60 * 1000)), // 1 yıl sonra
      listPrice: Math.round(avgSaleAmount * (0.8 + Math.random() * 0.4)), // ±20% varyasyon
      discountRate: 0,
      activitySalePrice: Math.round(avgSaleAmount * (0.8 + Math.random() * 0.4)),
      basePrimPrice: Math.round(avgSaleAmount * (0.8 + Math.random() * 0.4)),
      primAmount: Math.round(avgPrimAmount * (0.8 + Math.random() * 0.4)),
      primStatus: Math.random() > 0.5 ? 'ödendi' : 'ödenmedi',
      paymentType: 'Nakit',
      status: 'aktif',
      salesperson: userId,
      isHistoricalMigration: true,
      migratedFrom: 'CommunicationYear',
      migratedAt: new Date()
    });
  });
  
  // İptal edilen satış kayıtları oluştur
  cancelledSalesDates.forEach((date, index) => {
    records.push({
      customerName: `İptal Müşteri ${index + 1}`,
      blockNo: `B${Math.floor(Math.random() * 10) + 1}`,
      apartmentNo: `${Math.floor(Math.random() * 50) + 1}`,
      periodNo: `${Math.floor(Math.random() * 12) + 1}`,
      saleType: 'satis',
      contractNo: `GCI${year}${String(index + 1).padStart(4, '0')}`,
      saleDate: date,
      entryDate: date,
      exitDate: new Date(date.getTime() + (365 * 24 * 60 * 60 * 1000)),
      listPrice: Math.round(avgCancellationAmount * (0.8 + Math.random() * 0.4)),
      discountRate: 0,
      activitySalePrice: Math.round(avgCancellationAmount * (0.8 + Math.random() * 0.4)),
      basePrimPrice: Math.round(avgCancellationAmount * (0.8 + Math.random() * 0.4)),
      primAmount: 0, // İptal edilenler prim almaz
      primStatus: 'ödenmedi',
      paymentType: 'Nakit',
      status: 'iptal',
      salesperson: userId,
      isHistoricalMigration: true,
      migratedFrom: 'CommunicationYear',
      migratedAt: new Date(),
      cancellationDate: new Date(date.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000), // 0-30 gün sonra iptal
      cancellationReason: 'Geçmiş yıl iptali'
    });
  });
  
  console.log(`Generated ${records.length} sales records for ${userName} (${totalSales} active, ${totalCancellations} cancelled)`);
  return records;
}

// @route   POST /api/migration/historical-to-daily
// @desc    Geçmiş yıl verilerini günlük kayıtlara dönüştür
// @access  Admin only
router.post('/historical-to-daily', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🚀 Starting historical data migration to daily records...');
    
    const { years, dryRun = true } = req.body;
    
    if (!years || !Array.isArray(years) || years.length === 0) {
      return res.status(400).json({ 
        message: 'Geçirilecek yıllar belirtilmelidir (years array)' 
      });
    }
    
    const results = {
      processedYears: [],
      totalCommunicationRecords: 0,
      totalSalesRecords: 0,
      errors: [],
      dryRun: dryRun
    };
    
    // Her yıl için işlem yap
    for (const year of years) {
      console.log(`\n📅 Processing year ${year}...`);
      
      try {
        // Bu yıl için CommunicationYear kaydını bul
        const yearData = await CommunicationYear.findOne({ year: year });
        
        if (!yearData) {
          console.log(`❌ No data found for year ${year}`);
          results.errors.push(`Year ${year}: No data found`);
          continue;
        }
        
        if (!yearData.yearlySalesData || yearData.yearlySalesData.size === 0) {
          console.log(`❌ No sales data found for year ${year}`);
          results.errors.push(`Year ${year}: No sales data found`);
          continue;
        }
        
        const yearResults = {
          year: year,
          communicationRecords: 0,
          salesRecords: 0,
          processedUsers: 0
        };
        
        // Bu yıl için mevcut geçiş kayıtlarını kontrol et
        const existingRecords = await CommunicationRecord.countDocuments({
          year: year,
          isHistoricalMigration: true
        });
        
        if (existingRecords > 0 && !req.body.force) {
          console.log(`⚠️  Year ${year} already has ${existingRecords} migrated records. Use force=true to override.`);
          results.errors.push(`Year ${year}: Already migrated (${existingRecords} records). Use force=true to override.`);
          continue;
        }
        
        // Force mode ise mevcut kayıtları sil
        if (req.body.force && existingRecords > 0) {
          console.log(`🗑️  Removing ${existingRecords} existing migrated records for year ${year}...`);
          if (!dryRun) {
            await CommunicationRecord.deleteMany({
              year: year,
              isHistoricalMigration: true
            });
            await Sale.deleteMany({
              $expr: { $eq: [{ $year: '$saleDate' }, year] },
              isHistoricalMigration: true
            });
          }
        }
        
        // İletişim verilerini işle - hem yearlySalesData hem yearlyCommunicationData'dan kullanıcıları al
        const allUserIds = new Set();
        
        // Satış verisi olan kullanıcıları ekle
        if (yearData.yearlySalesData) {
          for (let userId of yearData.yearlySalesData.keys()) {
            allUserIds.add(userId);
          }
        }
        
        // İletişim verisi olan kullanıcıları ekle
        if (yearData.yearlyCommunicationData) {
          for (let userId of yearData.yearlyCommunicationData.keys()) {
            allUserIds.add(userId);
          }
        }
        
        console.log(`Found ${allUserIds.size} unique users for year ${year}`);
        
        // Her kullanıcı için sadece iletişim kayıtları oluştur
        for (let userId of allUserIds) {
          console.log(`👤 Processing user ${userId}...`);
          
          // Kullanıcı bilgilerini al - ObjectId hatasını önlemek için try-catch kullan
          let user = null;
          let userName = `Eski Temsilci ${userId}`;
          
          try {
            // Eğer userId ObjectId formatında ise User'dan al
            if (mongoose.Types.ObjectId.isValid(userId)) {
              user = await User.findById(userId);
              if (user) {
                userName = user.name;
              }
            } else {
              // String ise direkt kullan (historical user)
              userName = `Eski Temsilci ${userId}`;
            }
          } catch (error) {
            console.log(`Could not fetch user ${userId}, using default name`);
          }
          
          // İletişim verileri varsa kayıt oluştur
          const communicationData = yearData.yearlyCommunicationData?.get(userId) || {};
          if (Object.values(communicationData).some(val => val > 0)) {
            const commRecords = await createCommunicationRecords(userId, userName, year, communicationData);
            yearResults.communicationRecords += commRecords.length;
            
            if (!dryRun && commRecords.length > 0) {
              await CommunicationRecord.insertMany(commRecords);
              console.log(`✅ Inserted ${commRecords.length} communication records for ${userName}`);
            }
          }
          
          yearResults.processedUsers++;
        }
        
        results.processedYears.push(yearResults);
        results.totalCommunicationRecords += yearResults.communicationRecords;
        results.totalSalesRecords += yearResults.salesRecords;
        
        console.log(`✅ Year ${year} completed: ${yearResults.communicationRecords} comm + ${yearResults.salesRecords} sales records`);
        
      } catch (yearError) {
        console.error(`❌ Error processing year ${year}:`, yearError);
        results.errors.push(`Year ${year}: ${yearError.message}`);
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log(`📊 Total: ${results.totalCommunicationRecords} communication + ${results.totalSalesRecords} sales records`);
    
    if (dryRun) {
      console.log('🔍 DRY RUN - No actual data was inserted. Set dryRun=false to execute migration.');
    }
    
    res.json({
      success: true,
      message: dryRun ? 'Migration simulation completed' : 'Migration completed successfully',
      results: results
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ 
      message: 'Migration failed', 
      error: error.message 
    });
  }
});

// @route   GET /api/migration/historical-years
// @desc    Geçiş yapılabilir yılları listele
// @access  Admin only
router.get('/historical-years', [auth, adminAuth], async (req, res) => {
  try {
    const historicalYears = await CommunicationYear.find({
      type: 'historical',
      $or: [
        { 'yearlySalesData': { $exists: true, $ne: null } },
        { 'yearlyCommunicationData': { $exists: true, $ne: null } }
      ]
    }).select('year yearlySalesData yearlyCommunicationData').sort({ year: -1 });
    
    const yearsInfo = await Promise.all(
      historicalYears.map(async (yearData) => {
        // Bu yıl için mevcut geçiş kayıtlarını kontrol et
        const migratedCommRecords = await CommunicationRecord.countDocuments({
          year: yearData.year,
          isHistoricalMigration: true
        });
        
        const migratedSalesRecords = await Sale.countDocuments({
          $expr: { $eq: [{ $year: '$saleDate' }, yearData.year] },
          isHistoricalMigration: true
        });
        
        return {
          year: yearData.year,
          hasData: (yearData.yearlySalesData?.size || 0) > 0 || (yearData.yearlyCommunicationData?.size || 0) > 0,
          usersCount: yearData.yearlySalesData?.size || 0,
          communicationUsersCount: yearData.yearlyCommunicationData?.size || 0,
          alreadyMigrated: migratedCommRecords > 0 || migratedSalesRecords > 0,
          migratedRecords: {
            communication: migratedCommRecords,
            sales: migratedSalesRecords
          }
        };
      })
    );
    
    res.json(yearsInfo);
    
  } catch (error) {
    console.error('Historical years fetch error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
