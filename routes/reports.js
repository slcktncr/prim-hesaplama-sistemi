const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const Sale = require('../models/Sale');
const PrimTransaction = require('../models/PrimTransaction');
const User = require('../models/User');
const PrimPeriod = require('../models/PrimPeriod');
const CommunicationYear = require('../models/CommunicationYear');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Helper function: Geçmiş yıl verilerini günlük simülasyon verilerine dönüştür
function generateDailyHistoricalData(historicalYears, startDate, endDate, salesperson = null) {
  const dailyData = [];
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  
  console.log(`Generating daily historical data from ${startDate} to ${endDate}`);
  
  historicalYears.forEach(yearData => {
    if (!yearData.yearlySalesData || yearData.yearlySalesData.size === 0) {
      console.log(`Year ${yearData.year} has no sales data, skipping`);
      return;
    }
    
    console.log(`Processing year ${yearData.year} for daily distribution`);
    
    // Bu yıl için tarih aralığını hesapla
    const yearStart = new Date(Math.max(new Date(yearData.year, 0, 1), startDateObj));
    const yearEnd = new Date(Math.min(new Date(yearData.year, 11, 31), endDateObj));
    
    if (yearStart > yearEnd) {
      console.log(`Year ${yearData.year} outside date range, skipping`);
      return;
    }
    
    // Bu yıl içindeki toplam gün sayısını hesapla
    const totalDaysInRange = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24)) + 1;
    console.log(`Year ${yearData.year} has ${totalDaysInRange} days in range`);
    
    // Her kullanıcı için günlük dağıtım yap
    for (let [userId, salesData] of yearData.yearlySalesData) {
      // Eğer belirli bir temsilci seçildiyse, sadece o temsilciyi dahil et
      if (salesperson && userId !== salesperson) {
        continue;
      }
      
      console.log(`Distributing data for user ${userId}:`, salesData);
      
      // Günlük ortalama değerleri hesapla
      const dailyActiveSales = (salesData.totalSales || 0) / totalDaysInRange;
      const dailyAmount = (salesData.totalAmount || 0) / totalDaysInRange;
      const dailyPrim = (salesData.totalPrim || 0) / totalDaysInRange;
      const dailyCancellations = (salesData.cancellations || 0) / totalDaysInRange;
      const dailyCancellationAmount = (salesData.cancellationAmount || 0) / totalDaysInRange;
      
      // Her gün için veri oluştur
      for (let currentDate = new Date(yearStart); currentDate <= yearEnd; currentDate.setDate(currentDate.getDate() + 1)) {
        const dateKey = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        dailyData.push({
          date: new Date(currentDate),
          dateKey: dateKey,
          userId: userId,
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
          day: currentDate.getDate(),
          isHistorical: true,
          sales: {
            activeSales: dailyActiveSales,
            totalAmount: dailyAmount,
            totalPrim: dailyPrim,
            cancellations: dailyCancellations,
            cancellationAmount: dailyCancellationAmount
          }
        });
      }
      
      console.log(`Generated ${totalDaysInRange} daily records for user ${userId}`);
    }
  });
  
  console.log(`Total daily historical records generated: ${dailyData.length}`);
  return dailyData;
}

// @route   GET /api/reports/dashboard
// @desc    Dashboard özet bilgileri
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    let query = {};
    const { period } = req.query;
    
    // Dönem filtresi
    if (period && period !== 'all') {
      if (period === 'current') {
        const currentPeriod = await PrimPeriod.findOne({ isActive: true });
        if (currentPeriod) {
          query.primPeriod = currentPeriod._id;
        }
      } else {
        query.primPeriod = new mongoose.Types.ObjectId(period);
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Dashboard query:', JSON.stringify(query, null, 2));
      console.log('📅 Selected period:', period);
    }
    
    // Tüm kullanıcılar tüm verileri görebilir (sadece görüntüleme için)

    // Genel istatistikler
    const totalSales = await Sale.countDocuments({ ...query, status: 'aktif' });
    const cancelledSales = await Sale.countDocuments({ ...query, status: 'iptal' });
    
    const totalSalesAmount = await Sale.aggregate([
      { $match: { ...query, status: 'aktif' } },
      { $group: { _id: null, total: { $sum: '$basePrimPrice' } } }
    ]);
    
    const totalPrimAmount = await Sale.aggregate([
      { $match: { ...query, status: 'aktif' } },
      { $group: { _id: null, total: { $sum: '$primAmount' } } }
    ]);

    // Bu ayki satışlar (dönem seçiliyse dönem bazlı, değilse bu ay)
    let thisMonthSales;
    if (period && period !== 'all') {
      // Dönem seçiliyse sadece o dönemdeki satışlar
      thisMonthSales = totalSales;
    } else {
      // Dönem seçilmemişse bu ayki satışlar
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      thisMonthSales = await Sale.countDocuments({
        status: 'aktif',
        saleDate: { $gte: currentMonth }
      });
    }

    // Prim durumları
    const paidPrims = await Sale.countDocuments({ ...query, status: 'aktif', primStatus: 'ödendi' });
    const unpaidPrims = await Sale.countDocuments({ ...query, status: 'aktif', primStatus: 'ödenmedi' });

    // Satış türlerine göre istatistikler
    const salesByType = await Sale.aggregate([
      { $match: { ...query, status: 'aktif' } },
      { 
        $group: { 
          _id: '$saleType', 
          count: { $sum: 1 },
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' },
          avgAmount: { $avg: '$basePrimPrice' }
        } 
      },
      { $sort: { count: -1 } }
    ]);

    // Debug: Gerçek saleType değerlerini logla
    console.log('🔍 Dashboard - Gerçek saleType değerleri:', salesByType.map(item => item._id));

    // SaleType tablosundan dinamik mapping al
    const SaleType = require('../models/SaleType');
    const activeSaleTypes = await SaleType.find({ isActive: true }).select('name');
    
    // Satış türlerini dinamik olarak düzenle
    const saleTypesStats = {};
    
    // Varsayılan türleri ekle
    saleTypesStats.satis = salesByType.find(item => item._id === 'satis') || { _id: 'satis', count: 0, totalAmount: 0, totalPrim: 0, avgAmount: 0 };
    saleTypesStats.kapora = salesByType.find(item => item._id === 'kapora') || { _id: 'kapora', count: 0, totalAmount: 0, totalPrim: 0, avgAmount: 0 };
    
    // Dinamik türleri SaleType tablosundan al
    activeSaleTypes.forEach(saleType => {
      const lowerName = saleType.name.toLowerCase();
      let mappedKey = null;
      
      if (lowerName.includes('yazlık') || lowerName.includes('yazlik')) {
        mappedKey = 'yazlik';
      } else if (lowerName.includes('kışlık') || lowerName.includes('kislik')) {
        mappedKey = 'kislik';
      }
      
      if (mappedKey) {
        // SaleType name'inden saleType value'sını türet
        const saleTypeValue = lowerName.replace(/\s+/g, '').replace(/[^\w]/g, '').substring(0, 20);
        const foundStats = salesByType.find(item => item._id === saleTypeValue);
        
        if (foundStats) {
          saleTypesStats[mappedKey] = foundStats;
          console.log(`📊 Dinamik mapping: ${saleType.name} -> ${mappedKey} (${saleTypeValue})`);
        } else {
          saleTypesStats[mappedKey] = { _id: saleTypeValue, count: 0, totalAmount: 0, totalPrim: 0, avgAmount: 0 };
        }
      }
    });
    
    // Eksik olanları varsayılan değerlerle doldur
    if (!saleTypesStats.yazlik) {
      saleTypesStats.yazlik = salesByType.find(item => item._id === 'yazlik') || { _id: 'yazlik', count: 0, totalAmount: 0, totalPrim: 0, avgAmount: 0 };
    }
    if (!saleTypesStats.kislik) {
      saleTypesStats.kislik = salesByType.find(item => item._id === 'kislik') || { _id: 'kislik', count: 0, totalAmount: 0, totalPrim: 0, avgAmount: 0 };
    }

    // En başarılı temsilciler (sadece admin için) - Farklı kategorilerde
    let topPerformers = {
      salesCount: [], // Satış adeti liderleri
      salesAmount: [], // Satış tutarı liderleri
      primAmount: [] // Prim tutarı liderleri
    };

    if (req.user.role === 'admin') {
      const baseQuery = { ...query, status: 'aktif' }; // Tüm satış türleri dahil
      
      // Satış adeti liderleri
      const salesCountLeaders = await Sale.aggregate([
        { $match: baseQuery },
        { $group: { 
          _id: '$salesperson', 
          count: { $sum: 1 }, 
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' },
          maxSale: { $max: '$basePrimPrice' }
        } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        // Eski satış temsilcisini filtrele
        { $match: { 'user.email': { $ne: 'eski.satis@legacy.system' } } },
        { $project: { 
          name: '$user.name', 
          email: '$user.email',
          count: 1, 
          totalAmount: 1, 
          totalPrim: 1,
          avgAmount: { $divide: ['$totalAmount', '$count'] },
          maxSingleSale: '$maxSale'
        } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      // Satış tutarı liderleri
      const salesAmountLeaders = await Sale.aggregate([
        { $match: baseQuery },
        { $group: { 
          _id: '$salesperson', 
          count: { $sum: 1 }, 
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' },
          maxSale: { $max: '$basePrimPrice' }
        } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        // Eski satış temsilcisini filtrele
        { $match: { 'user.email': { $ne: 'eski.satis@legacy.system' } } },
        { $project: { 
          name: '$user.name', 
          email: '$user.email',
          count: 1, 
          totalAmount: 1, 
          totalPrim: 1,
          avgAmount: { $divide: ['$totalAmount', '$count'] },
          maxSingleSale: '$maxSale'
        } },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 }
      ]);

      // Prim tutarı liderleri
      const primAmountLeaders = await Sale.aggregate([
        { $match: baseQuery },
        { $group: { 
          _id: '$salesperson', 
          count: { $sum: 1 }, 
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' },
          maxSale: { $max: '$basePrimPrice' }
        } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        // Eski satış temsilcisini filtrele
        { $match: { 'user.email': { $ne: 'eski.satis@legacy.system' } } },
        { $project: { 
          name: '$user.name', 
          email: '$user.email',
          count: 1, 
          totalAmount: 1, 
          totalPrim: 1,
          avgAmount: { $divide: ['$totalAmount', '$count'] },
          maxSingleSale: '$maxSale'
        } },
        { $sort: { totalPrim: -1 } },
        { $limit: 5 }
      ]);

      topPerformers = {
        salesCount: salesCountLeaders,
        salesAmount: salesAmountLeaders,
        primAmount: primAmountLeaders
      };
    }

    res.json({
      totalSales,
      cancelledSales,
      totalSalesAmount: totalSalesAmount[0]?.total || 0,
      totalPrimAmount: totalPrimAmount[0]?.total || 0,
      thisMonthSales,
      paidPrims,
      unpaidPrims,
      topPerformers,
      saleTypesStats // Satış türleri istatistikleri
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/sales-summary
// @desc    Satış özet raporu
// @access  Private
router.get('/sales-summary', auth, async (req, res) => {
  try {
    const { startDate, endDate, salesperson, period } = req.query;
    
    let query = {};
    
    // Tüm kullanıcılar tüm verileri görebilir (sadece görüntüleme için)
    if (salesperson) {
      query.salesperson = salesperson;
    }
    
    // Tarih filtresi
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Dönem filtresi
    if (period) {
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }

    // Güncel Sale verilerini al
    const activeSales = await Sale.aggregate([
      { $match: { ...query, status: 'aktif' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalListPrice: { $sum: '$listPrice' },
          totalActivityPrice: { $sum: '$activitySalePrice' },
          totalBasePrimPrice: { $sum: '$basePrimPrice' },
          totalPrimAmount: { $sum: '$primAmount' },
          paidPrims: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödendi'] }, 1, 0] } },
          unpaidPrims: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödenmedi'] }, 1, 0] } }
        }
      }
    ]);

    const cancelledSales = await Sale.aggregate([
      { $match: { ...query, status: 'iptal' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalListPrice: { $sum: '$listPrice' },
          totalActivityPrice: { $sum: '$activitySalePrice' },
          totalBasePrimPrice: { $sum: '$basePrimPrice' },
          totalPrimAmount: { $sum: '$primAmount' }
        }
      }
    ]);

    // Geçmiş yıl verilerini günlük simülasyon olarak dahil et
    let historicalSalesData = {
      activeSales: { count: 0, totalAmount: 0, totalPrim: 0 },
      cancelledSales: { count: 0, totalAmount: 0 }
    };
    let dailyHistoricalData = [];

    if (startDate && endDate) {
      const startYear = new Date(startDate).getFullYear();
      const endYear = new Date(endDate).getFullYear();
      const currentYear = new Date().getFullYear();

      // Geçmiş yılları dahil et
      if (startYear < currentYear) {
        const historicalYears = await CommunicationYear.find({
          year: { $gte: startYear, $lt: currentYear }
        });

        console.log(`Sales Summary: Found ${historicalYears.length} historical years for range ${startYear}-${endYear}`);
        
        // Günlük simülasyon verilerini oluştur
        dailyHistoricalData = generateDailyHistoricalData(historicalYears, startDate, endDate, salesperson);
        
        // Günlük verilerden toplam hesapla
        dailyHistoricalData.forEach(dayData => {
          historicalSalesData.activeSales.count += dayData.sales.activeSales;
          historicalSalesData.activeSales.totalAmount += dayData.sales.totalAmount;
          historicalSalesData.activeSales.totalPrim += dayData.sales.totalPrim;
          historicalSalesData.cancelledSales.count += dayData.sales.cancellations;
          historicalSalesData.cancelledSales.totalAmount += dayData.sales.cancellationAmount;
        });

        console.log('Final historical sales data summary from daily simulation:', historicalSalesData);
      }
    }

    // Ödeme tipi dağılımı
    const paymentTypeDistribution = await Sale.aggregate([
      { $match: { ...query, status: 'aktif' } },
      {
        $addFields: {
          paymentTypeDisplay: {
            $ifNull: ['$paymentType', 'Kapora']
          }
        }
      },
      { $group: { _id: '$paymentTypeDisplay', count: { $sum: 1 }, totalAmount: { $sum: '$basePrimPrice' } } },
      { $sort: { count: -1 } }
    ]);

    // Aylık satış trendi (güncel veriler)
    const monthlySales = await Sale.aggregate([
      { $match: { ...query, status: 'aktif' } },
      {
        $group: {
          _id: { 
            year: { $year: '$saleDate' }, 
            month: { $month: '$saleDate' } 
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Günlük simülasyon verilerinden aylık satış trendi oluştur
    const combinedMonthlySales = [...monthlySales];
    
    if (dailyHistoricalData.length > 0) {
      console.log('Adding daily historical data to monthly sales...');
      
      // Günlük verileri aylık olarak grupla
      const monthlyHistoricalMap = new Map();
      
      dailyHistoricalData.forEach(dayData => {
        const monthKey = `${dayData.year}-${dayData.month}`;
        
        if (!monthlyHistoricalMap.has(monthKey)) {
          monthlyHistoricalMap.set(monthKey, {
            _id: { year: dayData.year, month: dayData.month },
            count: 0,
            totalAmount: 0,
            totalPrim: 0
          });
        }
        
        const monthData = monthlyHistoricalMap.get(monthKey);
        monthData.count += dayData.sales.activeSales;
        monthData.totalAmount += dayData.sales.totalAmount;
        monthData.totalPrim += dayData.sales.totalPrim;
      });
      
      // Aylık geçmiş verileri ana listeye ekle
      monthlyHistoricalMap.forEach(monthlyData => {
        // Aynı ay/yıl kombinasyonu zaten var mı kontrol et
        const existingIndex = combinedMonthlySales.findIndex(item => 
          item._id.year === monthlyData._id.year && 
          item._id.month === monthlyData._id.month
        );
        
        if (existingIndex >= 0) {
          // Mevcut veriye ekle
          combinedMonthlySales[existingIndex].count += monthlyData.count;
          combinedMonthlySales[existingIndex].totalAmount += monthlyData.totalAmount;
          combinedMonthlySales[existingIndex].totalPrim += monthlyData.totalPrim;
        } else {
          // Yeni ay verisi olarak ekle
          combinedMonthlySales.push(monthlyData);
        }
        
        console.log(`Added historical monthly data for ${monthlyData._id.year}/${monthlyData._id.month}: ${monthlyData.count.toFixed(2)} sales, ${monthlyData.totalAmount.toFixed(2)} amount`);
      });
      
      // Tarihe göre sırala
      combinedMonthlySales.sort((a, b) => {
        if (a._id.year !== b._id.year) return a._id.year - b._id.year;
        return a._id.month - b._id.month;
      });
      
      console.log('Combined monthly sales count:', combinedMonthlySales.length);
    }

    // Başarı oranı hesaplama için toplam satış sayısı (kapora + normal + iptal)
    const totalSalesCount = await Sale.countDocuments(query);
    
    // Gerçek satış sayısı (aktif durumda olan ve kapora olmayan satışlar)
    const realSalesCount = await Sale.countDocuments({
      ...query,
      status: 'aktif',
      saleType: { $ne: 'kapora' }
    });
    
    // Kapora durumundaki satışlar
    const kaporaSalesCount = await Sale.countDocuments({
      ...query,
      saleType: 'kapora'
    });
    
    // Başarı oranı hesaplama
    const successRate = totalSalesCount > 0 ? ((realSalesCount / totalSalesCount) * 100) : 0;

    // Güncel ve geçmiş verileri birleştir
    const combinedActiveSales = {
      count: (activeSales[0]?.count || 0) + historicalSalesData.activeSales.count,
      totalListPrice: activeSales[0]?.totalListPrice || 0, // Geçmiş yıl verilerinde bu alan yok
      totalActivityPrice: activeSales[0]?.totalActivityPrice || 0, // Geçmiş yıl verilerinde bu alan yok
      totalBasePrimPrice: (activeSales[0]?.totalBasePrimPrice || 0) + historicalSalesData.activeSales.totalAmount,
      totalPrimAmount: (activeSales[0]?.totalPrimAmount || 0) + historicalSalesData.activeSales.totalPrim,
      paidPrims: activeSales[0]?.paidPrims || 0, // Geçmiş yıl verilerinde bu detay yok
      unpaidPrims: activeSales[0]?.unpaidPrims || 0 // Geçmiş yıl verilerinde bu detay yok
    };

    const combinedCancelledSales = {
      count: (cancelledSales[0]?.count || 0) + historicalSalesData.cancelledSales.count,
      totalListPrice: cancelledSales[0]?.totalListPrice || 0,
      totalActivityPrice: cancelledSales[0]?.totalActivityPrice || 0,
      totalBasePrimPrice: (cancelledSales[0]?.totalBasePrimPrice || 0) + historicalSalesData.cancelledSales.totalAmount,
      totalPrimAmount: cancelledSales[0]?.totalPrimAmount || 0
    };

    // Toplam sayıları güncelle
    const combinedTotalSalesCount = totalSalesCount + historicalSalesData.activeSales.count + historicalSalesData.cancelledSales.count;
    const combinedRealSalesCount = realSalesCount + historicalSalesData.activeSales.count; // Geçmiş yıl verileri gerçek satış kabul ediliyor
    const combinedSuccessRate = combinedTotalSalesCount > 0 ? ((combinedRealSalesCount / combinedTotalSalesCount) * 100) : 0;

    res.json({
      activeSales: combinedActiveSales,
      cancelledSales: combinedCancelledSales,
      paymentTypeDistribution,
      monthlySales: combinedMonthlySales,
      successRateData: {
        totalSalesCount: combinedTotalSalesCount,
        realSalesCount: combinedRealSalesCount,
        kaporaSalesCount,     // Geçmiş yıl verilerinde kapora detayı yok
        cancelledCount: combinedCancelledSales.count,
        successRate: parseFloat(combinedSuccessRate.toFixed(1))
      },
      historicalDataIncluded: historicalSalesData.activeSales.count > 0 || historicalSalesData.cancelledSales.count > 0
    });
  } catch (error) {
    console.error('Sales summary error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/salesperson-performance
// @desc    Temsilci performans raporu
// @access  Private
router.get('/salesperson-performance', auth, async (req, res) => {
  try {
    const { startDate, endDate, period, salesperson, periods, salespersons } = req.query;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Salesperson Performance Query Params:', { startDate, endDate, period, salesperson, periods, salespersons });
    }
    
    let query = {};
    
    // Tarih filtresi
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Çoklu dönem filtresi (yeni)
    if (periods && Array.isArray(periods) && periods.length > 0) {
      query.primPeriod = { $in: periods.map(p => new mongoose.Types.ObjectId(p)) };
    } else if (period) {
      // Eski tek dönem filtresi (geriye uyumluluk)
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }
    
    // Çoklu temsilci filtresi (yeni)
    if (salespersons && Array.isArray(salespersons) && salespersons.length > 0) {
      query.salesperson = { $in: salespersons.map(s => new mongoose.Types.ObjectId(s)) };
    } else if (salesperson && salesperson !== '') {
      // Eski tek temsilci filtresi (geriye uyumluluk)
      query.salesperson = new mongoose.Types.ObjectId(salesperson);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Salesperson Performance MongoDB Query:', JSON.stringify(query, null, 2));
    }

    // Legacy user'ı bul
    const legacyUser = await User.findOne({ email: 'eski.satis@legacy.system' });
    console.log('🔍 Legacy user found:', legacyUser ? legacyUser.name : 'Not found');
    
    // Temsilci performansları (Legacy user hariç)
    const performance = await Sale.aggregate([
      { $match: { ...query, status: 'aktif' } },
      {
        $group: {
          _id: '$salesperson',
          totalSales: { $sum: 1 },
          totalSalesAmount: { $sum: '$basePrimPrice' },
          totalPrimAmount: { $sum: '$primAmount' },
          paidPrims: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödendi'] }, 1, 0] } },
          unpaidPrims: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödenmedi'] }, 1, 0] } },
          avgSaleAmount: { $avg: '$basePrimPrice' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      // Legacy user'ı filtrele
      {
        $match: {
          'user.email': { $ne: 'eski.satis@legacy.system' }
        }
      },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          totalSales: 1,
          totalSalesAmount: 1,
          totalPrimAmount: 1,
          paidPrims: 1,
          unpaidPrims: 1,
          avgSaleAmount: 1
        }
      },
      { $sort: { totalSales: -1, totalPrimAmount: -1 } }
    ]);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Salesperson Performance Results Count:', performance.length);
      console.log('Salesperson Performance Results:', JSON.stringify(performance, null, 2));
    }

    // İptal edilen satışlar
    const cancelledSalesPerformance = await Sale.aggregate([
      { $match: { ...query, status: 'iptal' } },
      {
        $group: {
          _id: '$salesperson',
          cancelledSales: { $sum: 1 },
          cancelledAmount: { $sum: '$basePrimPrice' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          name: '$user.name',
          cancelledSales: 1,
          cancelledAmount: 1
        }
      }
    ]);

    // Kesinti bilgilerini getir
    const deductions = await PrimTransaction.find({
      transactionType: 'kesinti'
    }).populate('salesperson', 'name');
    
    const deductionsByUser = {};
    deductions.forEach(deduction => {
      const userId = deduction.salesperson?._id?.toString();
      if (userId) {
        if (!deductionsByUser[userId]) {
          deductionsByUser[userId] = { count: 0, amount: 0 };
        }
        deductionsByUser[userId].count++;
        deductionsByUser[userId].amount += Math.abs(deduction.amount);
      }
    });

    // Performans verilerini birleştir (kesintiler dahil)
    const combinedPerformance = performance.map(perf => {
      const cancelled = cancelledSalesPerformance.find(c => c._id.toString() === perf._id.toString());
      const userDeductions = deductionsByUser[perf._id.toString()] || { count: 0, amount: 0 };
      
      return {
        ...perf,
        cancelledSales: cancelled?.cancelledSales || 0,
        cancelledAmount: cancelled?.cancelledAmount || 0,
        deductionCount: userDeductions.count,
        deductionAmount: userDeductions.amount,
        netPrimAmount: (perf.totalPrimAmount || 0) - userDeductions.amount
      };
    });

    res.json(combinedPerformance);
  } catch (error) {
    console.error('Salesperson performance error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/period-comparison
// @desc    Dönem karşılaştırma raporu (satış tarihine göre)
// @access  Private
router.get('/period-comparison', auth, async (req, res) => {
  try {
    let query = {};
    
    // Tüm kullanıcılar tüm verileri görebilir (sadece görüntüleme için)

    // Son 6 ayın gerçek tarih dönemlerini oluştur (satış tarihine göre)
    const now = new Date();
    const periods = [];
    
    for (let i = 0; i < 6; i++) {
      const periodDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0, 23, 59, 59);
      
      periods.push({
        name: periodDate.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' }),
        startDate: periodDate,
        endDate: periodEnd,
        year: periodDate.getFullYear(),
        month: periodDate.getMonth() + 1
      });
    }

    console.log('🗓️ Period comparison - Generated periods:', periods.map(p => ({ name: p.name, start: p.startDate, end: p.endDate })));

    const periodComparison = await Promise.all(
      periods.map(async (period) => {
        // Satış tarihine göre filtreleme yap (saleDate bazlı)
        const periodQuery = { 
          ...query, 
          saleDate: {
            $gte: period.startDate,
            $lte: period.endDate
          }
        };
        
        console.log(`📊 Period comparison - Querying for ${period.name}:`, periodQuery.saleDate);
        
        const activeSales = await Sale.aggregate([
          { $match: { ...periodQuery, status: 'aktif' } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: '$basePrimPrice' },
              totalPrim: { $sum: '$primAmount' },
              paidPrims: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödendi'] }, 1, 0] } }
            }
          }
        ]);
        
        const cancelledSales = await Sale.countDocuments({ ...periodQuery, status: 'iptal' });
        
        // Başarı oranı hesaplama
        const totalSalesCount = await Sale.countDocuments(periodQuery);
        const realSalesCount = await Sale.countDocuments({
          ...periodQuery,
          status: 'aktif',
          saleType: { $ne: 'kapora' }
        });
        const kaporaSalesCount = await Sale.countDocuments({
          ...periodQuery,
          saleType: 'kapora'
        });
        const successRate = totalSalesCount > 0 ? ((realSalesCount / totalSalesCount) * 100) : 0;
        
        const result = {
          period: period.name,
          periodYear: period.year,
          periodMonth: period.month,
          activeSales: activeSales[0]?.count || 0,
          cancelledSales,
          totalAmount: activeSales[0]?.totalAmount || 0,
          totalPrim: activeSales[0]?.totalPrim || 0,
          paidPrims: activeSales[0]?.paidPrims || 0,
          totalSalesCount,
          realSalesCount,
          kaporaSalesCount,
          successRate: parseFloat(successRate.toFixed(1))
        };
        
        console.log(`📈 Period comparison result for ${period.name}:`, { activeSales: result.activeSales, totalAmount: result.totalAmount });
        
        return result;
      })
    );

    console.log('🎯 Final period comparison data:', periodComparison.map(p => ({ period: p.period, activeSales: p.activeSales, totalAmount: p.totalAmount })));

    res.json(periodComparison);
  } catch (error) {
    console.error('Period comparison error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/top-performers
// @desc    En başarılı temsilciler
// @access  Private
router.get('/top-performers', auth, async (req, res) => {
  try {
    const { period, limit = 10 } = req.query;
    
    let query = { status: 'aktif' };
    
    // Tüm kullanıcılar tüm verileri görebilir (sadece görüntüleme için)
    
    // Dönem filtresi
    if (period) {
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }

    const topPerformersData = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$salesperson',
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' },
          avgSaleAmount: { $avg: '$basePrimPrice' },
          maxSingleSale: { $max: '$basePrimPrice' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      // Legacy user'ı filtrele
      {
        $match: {
          'user.email': { $ne: 'eski.satis@legacy.system' }
        }
      },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          totalSales: 1,
          totalAmount: 1,
          totalPrim: 1,
          avgSaleAmount: 1,
          maxSingleSale: 1
        }
      },
      { $sort: { totalSales: -1, totalPrim: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Kesinti bilgilerini getir ve net prim hesapla
    const deductions = await PrimTransaction.find({
      transactionType: 'kesinti'
    }).populate('salesperson', 'name');
    
    const deductionsByUser = {};
    deductions.forEach(deduction => {
      const userId = deduction.salesperson?._id?.toString();
      if (userId) {
        if (!deductionsByUser[userId]) {
          deductionsByUser[userId] = { count: 0, amount: 0 };
        }
        deductionsByUser[userId].count++;
        deductionsByUser[userId].amount += Math.abs(deduction.amount);
      }
    });

    // Net prim ile birlikte sonuçları hazırla
    const topPerformers = topPerformersData.map(performer => {
      const userDeductions = deductionsByUser[performer._id.toString()] || { count: 0, amount: 0 };
      
      return {
        ...performer,
        deductionCount: userDeductions.count,
        deductionAmount: userDeductions.amount,
        netPrimAmount: (performer.totalPrim || 0) - userDeductions.amount
      };
    });

    res.json(topPerformers);
  } catch (error) {
    console.error('Top performers error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/cancellation-performance
// @desc    İptal performansları raporu
// @access  Private
router.get('/cancellation-performance', auth, async (req, res) => {
  try {
    const { period, limit = 20 } = req.query;
    
    let matchQuery = {};
    
    // Dönem filtresi
    if (period && period !== '') {
      if (period === 'current') {
        const currentPeriod = await PrimPeriod.findOne({ isActive: true });
        if (currentPeriod) {
          matchQuery.primPeriod = currentPeriod._id;
        }
      } else {
        matchQuery.primPeriod = new mongoose.Types.ObjectId(period);
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🚫 Cancellation performance query:', JSON.stringify(matchQuery, null, 2));
    }
    
    // İptal performansları aggregation
    const cancellationPerformance = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$salesperson',
          totalSales: { 
            $sum: { $cond: [{ $eq: ['$status', 'aktif'] }, 1, 0] }
          },
          cancelledSales: { 
            $sum: { $cond: [{ $eq: ['$status', 'iptal'] }, 1, 0] }
          },
          totalAmount: { 
            $sum: { $cond: [{ $eq: ['$status', 'aktif'] }, '$basePrimPrice', 0] }
          },
          cancelledAmount: { 
            $sum: { $cond: [{ $eq: ['$status', 'iptal'] }, '$basePrimPrice', 0] }
          },
          totalPrim: { 
            $sum: { $cond: [{ $eq: ['$status', 'aktif'] }, '$primAmount', 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          totalSales: { $add: ['$totalSales', '$cancelledSales'] }, // Toplam satış (aktif + iptal)
          cancelledSales: 1,
          activeSales: '$totalSales', // Sadece aktif satışlar
          totalAmount: 1,
          cancelledAmount: 1,
          totalPrim: 1,
          cancellationRate: {
            $cond: [
              { $eq: [{ $add: ['$totalSales', '$cancelledSales'] }, 0] },
              0,
              {
                $multiply: [
                  { $divide: ['$cancelledSales', { $add: ['$totalSales', '$cancelledSales'] }] },
                  100
                ]
              }
            ]
          }
        }
      },
      { $sort: { cancellationRate: -1 } }, // İptal oranına göre azalan sıralama
      { $limit: parseInt(limit) }
    ]);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🚫 Cancellation performance results:', cancellationPerformance.length);
    }
    
    res.json(cancellationPerformance);
  } catch (error) {
    console.error('Cancellation performance error:', error);
    res.status(500).json({ message: 'İptal performans raporu alınırken hata oluştu' });
  }
});

// @route   GET /api/reports/detailed-report
// @desc    Detaylı rapor (Excel export için)
// @access  Private
router.get('/detailed-report', auth, async (req, res) => {
  try {
    const { startDate, endDate, salesperson, status = 'aktif', period, saleType } = req.query;
    
    let query = { status };
    
    // Tüm kullanıcılar tüm verileri görebilir (sadece görüntüleme için)
    if (salesperson) {
      query.salesperson = salesperson;
    }
    
    // Tarih filtresi
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Dönem filtresi
    if (period) {
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }

    // Satış türü filtresi
    if (saleType && saleType !== '') {
      query.saleType = saleType;
    }

    const detailedReport = await Sale.find(query)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .populate('cancelledBy', 'name')
      .populate('transferredFrom', 'name')
      .populate('transferredBy', 'name')
      .sort({ saleDate: -1 });

    res.json(detailedReport);
  } catch (error) {
    console.error('Detailed report error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/reports/export
// @desc    Rapor export et
// @access  Private
router.post('/export', auth, async (req, res) => {
  try {
    console.log('🔍 Export request started:', { body: req.body, user: req.user?.name });
    
    const { type, scope, period, salesperson } = req.body;
    
    if (!type) {
      return res.status(400).json({ message: 'Export tipi belirtilmeli' });
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Export request received:', { type, scope, period, salesperson });
    }
    
    let query = {};
    
    // Tüm kullanıcılar tüm verileri export edebilir
    if (scope === 'salesperson' && salesperson && salesperson !== 'all') {
      query.salesperson = salesperson;
    }
    
    // Dönem filtresi
    if (scope === 'period' && period && period !== 'all') {
      if (period === 'current') {
        const currentPeriod = await PrimPeriod.findOne({ isActive: true });
        if (currentPeriod) {
          query.primPeriod = currentPeriod._id;
        }
      } else {
        query.primPeriod = new mongoose.Types.ObjectId(period);
      }
    }
    
    // Filtrelenmiş veri export'u
    if (scope === 'filtered') {
      const { startDate, endDate, periods, salespersons } = req.body;
      
      // Tarih filtresi
      if (startDate && endDate) {
        query.saleDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      // Çoklu dönem filtresi
      if (periods && Array.isArray(periods) && periods.length > 0) {
        query.primPeriod = { $in: periods.map(p => new mongoose.Types.ObjectId(p)) };
      }
      
      // Çoklu temsilci filtresi
      if (salespersons && Array.isArray(salespersons) && salespersons.length > 0) {
        query.salesperson = { $in: salespersons.map(s => new mongoose.Types.ObjectId(s)) };
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Filtered export query:', JSON.stringify(query, null, 2));
      }
    }
    
    // Satışları getir
    const sales = await Sale.find(query)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .sort({ saleDate: -1 });
    
    // Güncel dönem performansı için aktif dönemi bul
    const currentPeriod = await PrimPeriod.findOne({ isActive: true });
    let currentPeriodPerformance = [];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Current period found:', currentPeriod ? currentPeriod.name : 'No active period');
    }
    
    if (currentPeriod) {
      // Önce tüm kullanıcıları al (Legacy user hariç)
      const allUsers = await User.find({ 
        isActive: true, 
        email: { $ne: 'eski.satis@legacy.system' }
      }).select('name email');
      
      // Aktif dönemde satışı olan temsilcileri al
      const salesPerformance = await Sale.aggregate([
        { 
          $match: { 
            primPeriod: currentPeriod._id,
            status: 'aktif'
          } 
        },
        {
          $group: {
            _id: '$salesperson',
            totalSales: { $sum: 1 },
            totalAmount: { $sum: '$basePrimPrice' },
            totalPrimAmount: { $sum: '$primAmount' },
            avgSaleAmount: { $avg: '$basePrimPrice' }
          }
        }
      ]);
      
      // Satış verilerini kullanıcı ID'sine göre map'le
      const salesMap = {};
      salesPerformance.forEach(perf => {
        salesMap[perf._id.toString()] = perf;
      });
      
      // Tüm kullanıcılar için performans verisi oluştur
      currentPeriodPerformance = allUsers.map(user => {
        const userSales = salesMap[user._id.toString()];
        return {
          name: user.name,
          email: user.email,
          totalSales: userSales ? userSales.totalSales : 0,
          totalAmount: userSales ? userSales.totalAmount : 0,
          totalPrimAmount: userSales ? userSales.totalPrimAmount : 0,
          avgSaleAmount: userSales ? userSales.avgSaleAmount : 0
        };
      }).sort((a, b) => {
        // Önce satış adedine göre sırala
        if (b.totalSales !== a.totalSales) {
          return b.totalSales - a.totalSales;
        }
        // Satış adedi aynıysa prim tutarına göre sırala
        return b.totalPrimAmount - a.totalPrimAmount;
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 All users count:', allUsers.length);
        console.log('📊 Users with sales in current period:', salesPerformance.length);
        console.log('📊 Current period performance count:', currentPeriodPerformance.length);
        console.log('📊 Current period performance sample:', currentPeriodPerformance[0]);
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Sales data for export:', { 
        salesCount: sales.length, 
        query: JSON.stringify(query),
        sampleSale: sales[0] ? {
          customerName: sales[0].customerName,
          contractNo: sales[0].contractNo,
          salesperson: sales[0].salesperson?.name,
          primPeriod: sales[0].primPeriod?.name
        } : 'No sales found'
      });
    }
    
    if (type === 'excel') {
      console.log('📊 Creating Excel workbook...');
      // Excel workbook oluştur
      const wb = XLSX.utils.book_new();

      // 1. ÖZET SAYFA - Dashboard benzeri
      const summaryData = [
        ['MOLA PRİM SİSTEMİ - ÖZET RAPORU'],
        [''],
        ['Rapor Tarihi:', new Date().toLocaleDateString('tr-TR')],
        ['Rapor Saati:', new Date().toLocaleTimeString('tr-TR')],
        [''],
        ['GENEL İSTATİSTİKLER'],
        ['Toplam Satış Sayısı:', sales.length],
        ['Aktif Satışlar:', sales.filter(s => s.status === 'aktif').length],
        ['İptal Edilenler:', sales.filter(s => s.status === 'iptal').length],
        [''],
        ['PRİM İSTATİSTİKLERİ'],
        ['Ödenen Primler:', sales.filter(s => s.primStatus === 'ödendi').length],
        ['Bekleyen Primler:', sales.filter(s => s.primStatus === 'ödenmedi').length],
        ['Toplam Prim Tutarı:', sales.reduce((sum, s) => sum + (s.primAmount || 0), 0)],
        ['Toplam Satış Tutarı:', sales.filter(s => s.status === 'aktif').reduce((sum, s) => sum + (s.basePrimPrice || 0), 0)],
        [''],
        ['TEMSİLCİ PERFORMANSI']
      ];

      // Temsilci performans verilerini ekle (PrimEarnings'deki gibi)
      // PrimTransaction zaten import edildi
      
      // Temsilci başına kesinti bilgilerini getir (web sitesi ile aynı mantık)
      const deductionsByUser = {};
      const deductionsByUserId = {}; // ID bazlı mapping için
      try {
        console.log('📊 Fetching deductions...');
        const allDeductions = await PrimTransaction.find({
          transactionType: 'kesinti',
          deductionStatus: 'yapıldı' // Sadece onaylanmış kesintiler
        }).populate('salesperson', 'name');
        
        console.log('📊 Deductions found:', allDeductions.length);
        
        allDeductions.forEach(deduction => {
          const userName = deduction.salesperson?.name || 'Bilinmiyor';
          const userId = deduction.salesperson?._id?.toString();
          
          if (!deductionsByUser[userName]) {
            deductionsByUser[userName] = { count: 0, amount: 0 };
          }
          if (userId && !deductionsByUserId[userId]) {
            deductionsByUserId[userId] = { count: 0, amount: 0 };
          }
          
          deductionsByUser[userName].count++;
          deductionsByUser[userName].amount += Math.abs(deduction.amount);
          
          if (userId) {
            deductionsByUserId[userId].count++;
            deductionsByUserId[userId].amount += Math.abs(deduction.amount);
          }
        });
        
        console.log('📊 Deductions by user:', deductionsByUser);
      } catch (error) {
        console.error('❌ Deductions fetch error:', error);
        // Hata olursa boş obje ile devam et
      }

      // Satış verilerini temsilci bazında topla (web sitesi ile aynı mantık)
      const salesByUser = {};
      sales.filter(sale => sale.status === 'aktif').forEach(sale => { // Sadece aktif satışlar
        const userName = sale.salesperson?.name || 'Bilinmiyor';
        if (!salesByUser[userName]) {
          salesByUser[userName] = { count: 0, amount: 0, primAmount: 0 };
        }
        salesByUser[userName].count++;
        salesByUser[userName].amount += (sale.basePrimPrice || 0); // Web sitesi basePrimPrice kullanıyor
        salesByUser[userName].primAmount += (sale.primAmount || 0);
      });

      console.log('📊 Sales by user (before deductions):', salesByUser);
      console.log('📊 Total active sales used:', sales.filter(sale => sale.status === 'aktif').length);
      console.log('📊 Sample active sale data:', sales.filter(sale => sale.status === 'aktif')[0] ? {
        customerName: sales.filter(sale => sale.status === 'aktif')[0].customerName,
        basePrimPrice: sales.filter(sale => sale.status === 'aktif')[0].basePrimPrice,
        primAmount: sales.filter(sale => sale.status === 'aktif')[0].primAmount,
        salesperson: sales.filter(sale => sale.status === 'aktif')[0].salesperson?.name
      } : 'No active sales');

      // Net hakediş hesapla (brüt prim - kesintiler)
      Object.entries(salesByUser)
        .sort((a, b) => {
          // Önce satış adedine göre sırala
          if (b[1].count !== a[1].count) {
            return b[1].count - a[1].count;
          }
          // Satış adedi aynıysa prim tutarına göre sırala
          return b[1].primAmount - a[1].primAmount;
        })
        .forEach(([name, data]) => {
          const deductions = deductionsByUser[name]?.amount || 0;
          const netPrim = data.primAmount - deductions;
          summaryData.push([
            name, 
            `${data.count} satış`, 
            `${data.amount.toLocaleString('tr-TR')} ₺ ciro`, 
            `${data.primAmount.toLocaleString('tr-TR')} ₺ brüt prim`,
            deductions > 0 ? `${deductions.toLocaleString('tr-TR')} ₺ kesinti` : 'Kesinti yok',
            `${netPrim.toLocaleString('tr-TR')} ₺ net hakediş`
          ]);
        });

      console.log('📊 Creating summary sheet...');
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Özet');
      console.log('✅ Summary sheet added');

      // 2. DETAYLI SATIŞ LİSTESİ
      const detailedData = sales.map(sale => ({
        'Müşteri Adı': sale.customerName || '',
        'Blok/Daire': `${sale.blockNo || ''}/${sale.apartmentNo || ''}`,
        'Dönem No': sale.periodNo || '',
        'Satış Tarihi': sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('tr-TR') : '',
        'Kapora Tarihi': sale.kaporaDate ? new Date(sale.kaporaDate).toLocaleDateString('tr-TR') : '',
        'Sözleşme No': sale.contractNo || '',
        'Satış Türü': sale.saleType || '',
        'Liste Fiyatı': sale.listPrice || 0,
        'Orijinal Liste Fiyatı': sale.originalListPrice || 0,
        'Aktivite Satış Fiyatı': sale.activitySalePrice || 0,
        'Baz Prim Fiyatı': sale.basePrimPrice || 0,
        'Ödeme Tipi': sale.paymentType || 'Belirsiz',
        'Prim Oranı': sale.primRate || 0,
        'Prim Tutarı': sale.primAmount || 0,
      'Prim Durumu': sale.primStatus === 'ödendi' ? 'Ödendi' : 'Ödenmedi',
      'Temsilci': sale.salesperson?.name || 'Bilinmiyor',
      'Prim Dönemi': sale.primPeriod?.name || 'Bilinmiyor',
        'Durum': sale.status === 'aktif' ? 'Aktif' : 'İptal',
        'Notlar': sale.notes || '',
        'Oluşturma Tarihi': sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('tr-TR') : '',
        'Güncellenme Tarihi': sale.updatedAt ? new Date(sale.updatedAt).toLocaleDateString('tr-TR') : ''
      }));

      const detailedWs = XLSX.utils.json_to_sheet(detailedData);
      detailedWs['!cols'] = [
        { wch: 25 }, // Müşteri Adı
        { wch: 12 }, // Blok/Daire
        { wch: 10 }, // Dönem No
        { wch: 12 }, // Satış Tarihi
        { wch: 12 }, // Kapora Tarihi
        { wch: 15 }, // Sözleşme No
        { wch: 12 }, // Satış Türü
        { wch: 15 }, // Liste Fiyatı
        { wch: 18 }, // Orijinal Liste Fiyatı
        { wch: 18 }, // Aktivite Satış Fiyatı
        { wch: 15 }, // Baz Prim Fiyatı
        { wch: 12 }, // Ödeme Tipi
        { wch: 10 }, // Prim Oranı
        { wch: 12 }, // Prim Tutarı
        { wch: 12 }, // Prim Durumu
        { wch: 20 }, // Temsilci
        { wch: 15 }, // Prim Dönemi
        { wch: 10 }, // Durum
        { wch: 30 }, // Notlar
        { wch: 12 }, // Oluşturma Tarihi
        { wch: 12 }  // Güncellenme Tarihi
      ];

      // Para formatı uygula
      const range = XLSX.utils.decode_range(detailedWs['!ref']);
      for (let row = 1; row <= range.e.r; row++) {
        [7, 8, 9, 10, 13].forEach(col => { // Liste Fiyatı, Orijinal Liste, Aktivite Fiyatı, Baz Prim, Prim Tutarı
          const cell = XLSX.utils.encode_cell({ r: row, c: col });
          if (detailedWs[cell]) {
            detailedWs[cell].t = 'n';
            detailedWs[cell].z = '#,##0"₺"';
          }
        });
        // Prim oranı için yüzde formatı
        const primRateCell = XLSX.utils.encode_cell({ r: row, c: 12 });
        if (detailedWs[primRateCell]) {
          detailedWs[primRateCell].t = 'n';
          detailedWs[primRateCell].z = '0.00"%"';
        }
      }

      XLSX.utils.book_append_sheet(wb, detailedWs, 'Detaylı Satışlar');
      console.log('✅ Detailed sales sheet added');

      // 3. TEMSİLCİ BAZLI ÖZET (Web sitesindeki verilerle tutarlı)
      const salesmanData = Object.entries(salesByUser)
        .sort((a, b) => {
          // Önce satış adedine göre sırala
          if (b[1].count !== a[1].count) {
            return b[1].count - a[1].count;
          }
          // Satış adedi aynıysa prim tutarına göre sırala
          return b[1].primAmount - a[1].primAmount;
        })
        .map(([name, data]) => {
          const deductions = deductionsByUser[name]?.amount || 0;
          const netPrim = data.primAmount - deductions;
          return {
            'Temsilci Adı': name,
            'Toplam Satış': data.count,
            'Toplam Ciro': data.amount,
            'Brüt Prim': data.primAmount,
            'Kesinti': deductions,
            'Net Hakediş': netPrim,
            'Ortalama Satış': data.count > 0 ? Math.round(data.amount / data.count) : 0,
            'Prim Oranı': data.amount > 0 ? `%${((data.primAmount / data.amount) * 100).toFixed(2)}` : '%0.00'
          };
        });

      const salesmanWs = XLSX.utils.json_to_sheet(salesmanData);
      salesmanWs['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];

      // Para formatı (yeni sütunlar için)
      const salesmanRange = XLSX.utils.decode_range(salesmanWs['!ref']);
      for (let row = 1; row <= salesmanRange.e.r; row++) {
        [2, 3, 4, 5, 6].forEach(col => { // Ciro, Brüt Prim, Kesinti, Net Hakediş, Ortalama
          const cell = XLSX.utils.encode_cell({ r: row, c: col });
          if (salesmanWs[cell]) {
            salesmanWs[cell].t = 'n';
            if (col === 2 || col === 3 || col === 4 || col === 5 || col === 6) {
              salesmanWs[cell].z = '#,##0"₺"';
            }
          }
        });
      }

      XLSX.utils.book_append_sheet(wb, salesmanWs, 'Temsilci Analizi');
      console.log('✅ Salesman analysis sheet added');

      // 4. DÖNEMSEL ANALİZ
      const periodData = {};
      sales.forEach(sale => {
        const periodName = sale.primPeriod?.name || 'Belirsiz';
        if (!periodData[periodName]) {
          periodData[periodName] = { count: 0, amount: 0, primAmount: 0 };
        }
        periodData[periodName].count++;
        periodData[periodName].amount += (sale.basePrimPrice || sale.listPrice || 0);
        periodData[periodName].primAmount += (sale.primAmount || 0);
      });

      const periodAnalysis = Object.entries(periodData).map(([period, data]) => ({
        'Dönem': period,
        'Satış Sayısı': data.count,
        'Toplam Ciro': data.amount,
        'Toplam Prim': data.primAmount,
        'Ortalama Satış': Math.round(data.amount / data.count),
        'Prim Oranı': `%${((data.primAmount / data.amount) * 100).toFixed(2)}`
      }));

      const periodWs = XLSX.utils.json_to_sheet(periodAnalysis);
      periodWs['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];

      // Para formatı
      const periodRange = XLSX.utils.decode_range(periodWs['!ref']);
      for (let row = 1; row <= periodRange.e.r; row++) {
        [2, 3, 4].forEach(col => {
          const cell = XLSX.utils.encode_cell({ r: row, c: col });
          if (periodWs[cell]) {
            periodWs[cell].t = 'n';
            periodWs[cell].z = '#,##0"₺"';
          }
        });
      }

      XLSX.utils.book_append_sheet(wb, periodWs, 'Dönemsel Analiz');
      console.log('✅ Period analysis sheet added');

      // 5. ÖDEME TİPİ ANALİZİ
      const paymentData = {};
      sales.forEach(sale => {
        const paymentType = sale.paymentType || (sale.saleType === 'kapora' ? 'Kapora' : 'Belirsiz');
        if (!paymentData[paymentType]) {
          paymentData[paymentType] = { count: 0, amount: 0, primAmount: 0 };
        }
        paymentData[paymentType].count++;
        paymentData[paymentType].amount += (sale.basePrimPrice || sale.listPrice || 0);
        paymentData[paymentType].primAmount += (sale.primAmount || 0);
      });

      const paymentAnalysis = Object.entries(paymentData).map(([type, data]) => ({
        'Ödeme Tipi': type,
        'Satış Sayısı': data.count,
        'Toplam Tutar': data.amount,
        'Toplam Prim': data.primAmount,
        'Oran': `%${((data.count / sales.length) * 100).toFixed(1)}`
      }));

      const paymentWs = XLSX.utils.json_to_sheet(paymentAnalysis);
      paymentWs['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];

      XLSX.utils.book_append_sheet(wb, paymentWs, 'Ödeme Analizi');
      console.log('✅ Payment analysis sheet added');

      // 6. GÜNCEL DÖNEM PERFORMANSI
      if (currentPeriodPerformance.length > 0) {
        const currentPeriodData = currentPeriodPerformance.map(performer => ({
          'Temsilci Adı': performer.name,
          'Satış Sayısı': performer.totalSales,
          'Toplam Ciro': performer.totalAmount,
          'Toplam Prim': performer.totalPrimAmount,
          'Ortalama Satış': Math.round(performer.avgSaleAmount),
          'Prim Oranı': `%${((performer.totalPrimAmount / performer.totalAmount) * 100).toFixed(2)}`
        }));

        const currentPeriodWs = XLSX.utils.json_to_sheet(currentPeriodData);
        currentPeriodWs['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];

        // Para formatı
        const currentRange = XLSX.utils.decode_range(currentPeriodWs['!ref']);
        for (let row = 1; row <= currentRange.e.r; row++) {
          [2, 3, 4].forEach(col => { // Ciro, Prim, Ortalama
            const cell = XLSX.utils.encode_cell({ r: row, c: col });
            if (currentPeriodWs[cell]) {
              currentPeriodWs[cell].t = 'n';
              currentPeriodWs[cell].z = '#,##0"₺"';
            }
          });
        }

        XLSX.utils.book_append_sheet(wb, currentPeriodWs, 'Güncel Dönem Performansı');
        console.log('✅ Current period performance sheet added');
      }

      console.log('📊 Creating Excel buffer...');
      // Excel buffer oluştur
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      console.log('📊 Excel buffer created, size:', excelBuffer.length);
      
      // Dosya adı oluştur
      const fileName = `prim_raporu_detayli_${new Date().toISOString().split('T')[0]}.xlsx`;
      console.log('📊 Sending Excel file:', fileName);
      
      // Response headers ayarla
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Length', excelBuffer.length);
      
      // Excel dosyasını gönder
      res.send(excelBuffer);
      console.log('✅ Excel file sent successfully');
      
    } else {
      // PDF export - sistem görüntüsü formatında
      const doc = new PDFDocument({ 
        layout: 'portrait',
        margin: 30,
        size: 'A4'
      });
      
      // Türkçe karakter desteği
      doc.font('Helvetica');
      
      // PDF'yi buffer olarak topla
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        
        // Dosya adı oluştur
        const fileName = `prim_raporu_${new Date().toISOString().split('T')[0]}.pdf`;
        
        // Response headers ayarla
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // PDF dosyasını gönder
        res.send(pdfBuffer);
      });

      // Sayfa boyutları
      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 30;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = margin;

      // Başlık - sistemdeki gibi
      doc.fontSize(24)
         .fillColor('#2c3e50')
         .text('🎯 En İyi Performans Gösteren Temsilciler', margin, yPos, { 
           align: 'center', 
           width: contentWidth 
         });
      yPos += 35;
      
      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text('Satış adedine göre sıralanmış en başarılı temsilciler', margin, yPos, { 
           align: 'center', 
           width: contentWidth 
         });
      yPos += 40;

      // Top 3 Performans Kartları (sistemdeki gibi)
      const salesByUser = {};
      sales.forEach(sale => {
        const userName = sale.salesperson?.name || 'Bilinmiyor';
        if (!salesByUser[userName]) {
          salesByUser[userName] = { count: 0, amount: 0, primAmount: 0 };
        }
        salesByUser[userName].count++;
        salesByUser[userName].amount += (sale.listPrice || 0);
        salesByUser[userName].primAmount += (sale.primAmount || 0);
      });

      // Net prim hesapla (kesintiler dahil)
      Object.keys(salesByUser).forEach(userName => {
        const deductions = deductionsByUser[userName] || 0;
        salesByUser[userName].netPrimAmount = salesByUser[userName].primAmount - deductions;
        salesByUser[userName].deductions = deductions;
      });

      const topPerformers = Object.entries(salesByUser)
        .sort((a, b) => {
          // Önce satış adedine göre sırala
          if (b[1].count !== a[1].count) {
            return b[1].count - a[1].count;
          }
          // Satış adedi aynıysa prim tutarına göre sırala
          return b[1].primAmount - a[1].primAmount;
        })
        .slice(0, 3);

      // Kart boyutları
      const cardWidth = (contentWidth - 40) / 3;
      const cardHeight = 120;
      
      // Top 3 kartları çiz
      topPerformers.forEach(([name, data], index) => {
        const xPos = margin + (cardWidth + 20) * index;
        
        // Kart arka planı
        let cardColor = '#f39c12'; // 1. sıra altın
        if (index === 1) cardColor = '#95a5a6'; // 2. sıra gümüş
        if (index === 2) cardColor = '#cd7f32'; // 3. sıra bronz
        
        // Kart çerçevesi
        doc.roundedRect(xPos, yPos, cardWidth, cardHeight, 10)
           .fillAndStroke('#ffffff', cardColor)
           .lineWidth(3);
        
        // Madalya ikonu
        doc.circle(xPos + cardWidth/2, yPos + 30, 15)
           .fillAndStroke(cardColor, cardColor);
        
        doc.fillColor('#ffffff')
           .fontSize(14)
           .text(`${index + 1}`, xPos + cardWidth/2 - 5, yPos + 25);
        
        // Sıralama badge
        doc.roundedRect(xPos + 10, yPos + 55, 30, 20, 5)
           .fillAndStroke(cardColor, cardColor);
        
        doc.fillColor('#ffffff')
           .fontSize(10)
           .text(`#${index + 1}`, xPos + 15, yPos + 62);
        
        // İsim
        doc.fillColor('#2c3e50')
           .fontSize(11)
           .text(name.toUpperCase(), xPos + 5, yPos + 80, { 
             width: cardWidth - 10, 
          align: 'center' 
        });
        
        // Satış sayısı
        doc.fillColor('#3498db')
           .fontSize(16)
           .text(data.count.toString(), xPos + 5, yPos + 95, { 
             width: cardWidth - 10, 
             align: 'center' 
           });
        
        // Prim tutarı
        doc.fillColor('#27ae60')
           .fontSize(8)
           .text(`₺${data.primAmount.toLocaleString('tr-TR')}`, xPos + 5, yPos + 110, { 
             width: cardWidth - 10, 
             align: 'center' 
           });
      });
      
      yPos += cardHeight + 40;

      // Performans İstatistikleri Kutusu - sistemdeki gibi
      doc.fontSize(16)
         .fillColor('#2c3e50')
         .text('🏆 Performans İstatistikleri', margin + contentWidth - 200, yPos - 160);
      
      // İstatistikler kutusu
      const statsBoxX = margin + contentWidth - 200;
      const statsBoxY = yPos - 130;
      const statsBoxWidth = 180;
      const statsBoxHeight = 140;
      
      doc.roundedRect(statsBoxX, statsBoxY, statsBoxWidth, statsBoxHeight, 8)
         .fillAndStroke('#f8f9fa', '#dee2e6');
      
      const activeSales = sales.filter(s => s.status === 'aktif');
      const totalSalesCount = sales.length;
      const totalPrimAmount = sales.reduce((sum, s) => sum + (s.primAmount || 0), 0);
      
      // İstatistik satırları
      const statY = statsBoxY + 15;
      doc.fillColor('#2c3e50')
         .fontSize(10);
      
      doc.text('En Yüksek Satış:', statsBoxX + 10, statY);
      doc.text(topPerformers[0] ? topPerformers[0][1].count.toString() : '0', statsBoxX + 120, statY);
      
      doc.text('En Yüksek Prim:', statsBoxX + 10, statY + 20);
      doc.text(`₺${topPerformers[0] ? topPerformers[0][1].primAmount.toLocaleString('tr-TR') : '0'}`, statsBoxX + 120, statY + 20);
      
      doc.text('Ortalama Satış:', statsBoxX + 10, statY + 40);
      const avgSales = totalSalesCount > 0 ? (totalSalesCount / Object.keys(salesByUser).length).toFixed(1) : '0';
      doc.text(avgSales, statsBoxX + 120, statY + 40);
      
      doc.text('Toplam Satış:', statsBoxX + 10, statY + 60);
      doc.text(totalSalesCount.toString(), statsBoxX + 120, statY + 60);
      
      doc.text('Toplam Prim:', statsBoxX + 10, statY + 80);
      doc.text(`₺${totalPrimAmount.toLocaleString('tr-TR')}`, statsBoxX + 120, statY + 80);
      
      // Yeni sayfa
          doc.addPage();
          yPos = margin;
      
      // 4 Ana İstatistik Kartı - sistemdeki gibi
      const cardStatHeight = 80;
      const cardStatWidth = (contentWidth - 30) / 2;
      
      const realSalesCount = sales.filter(s => s.status === 'aktif' && s.saleType !== 'kapora').length;
      const cancelledSales = sales.filter(s => s.status === 'iptal');
      const successRate = totalSalesCount > 0 ? ((realSalesCount / totalSalesCount) * 100) : 0;
      
      // Aktif Satış kartı (yeşil)
      doc.roundedRect(margin, yPos, cardStatWidth, cardStatHeight, 10)
         .fillAndStroke('#e8f5e8', '#27ae60');
      
      doc.fillColor('#27ae60')
         .fontSize(32)
         .text(activeSales.length.toString(), margin + 20, yPos + 15);
      
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .text('Aktif Satış', margin + 20, yPos + 55);
      
      const activeTotalAmount = activeSales.reduce((sum, s) => sum + (s.basePrimPrice || s.listPrice || 0), 0);
      doc.fontSize(10)
         .text(`₺${activeTotalAmount.toLocaleString('tr-TR')}`, margin + 20, yPos + 70);
      
      // İptal Edilen kartı (kırmızı)
      doc.roundedRect(margin + cardStatWidth + 10, yPos, cardStatWidth, cardStatHeight, 10)
         .fillAndStroke('#ffebee', '#e74c3c');
      
      doc.fillColor('#e74c3c')
         .fontSize(32)
         .text(cancelledSales.length.toString(), margin + cardStatWidth + 30, yPos + 15);
      
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .text('İptal Edilen', margin + cardStatWidth + 30, yPos + 55);
      
      const cancelledTotalAmount = cancelledSales.reduce((sum, s) => sum + (s.basePrimPrice || s.listPrice || 0), 0);
      doc.fontSize(10)
         .text(`₺${cancelledTotalAmount.toLocaleString('tr-TR')}`, margin + cardStatWidth + 30, yPos + 70);
      
      yPos += cardStatHeight + 20;
      
      // Toplam Prim kartı (mavi)
      doc.roundedRect(margin, yPos, cardStatWidth, cardStatHeight, 10)
         .fillAndStroke('#e3f2fd', '#2196f3');
      
      doc.fillColor('#2196f3')
         .fontSize(24)
         .text(`₺${totalPrimAmount.toLocaleString('tr-TR')}`, margin + 20, yPos + 20);
      
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .text('Toplam Prim', margin + 20, yPos + 55);
      
      doc.fontSize(10)
         .text('Ödenen: 0', margin + 20, yPos + 70);
      
      // Başarı Oranı kartı (turuncu)
      doc.roundedRect(margin + cardStatWidth + 10, yPos, cardStatWidth, cardStatHeight, 10)
         .fillAndStroke('#fff3e0', '#ff9800');
      
      doc.fillColor('#ff9800')
         .fontSize(32)
         .text(`%${successRate.toFixed(1)}`, margin + cardStatWidth + 30, yPos + 15);
      
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .text('Başarı Oranı', margin + cardStatWidth + 30, yPos + 55);
      
      doc.fontSize(10)
         .text(`Ödenmemiş: ${realSalesCount}`, margin + cardStatWidth + 30, yPos + 70);
      
      yPos += cardStatHeight + 30;
      
      // Tüm Performans Listesi - sistemdeki gibi
      doc.fontSize(18)
         .fillColor('#2c3e50')
         .text('Tüm Performans Listesi', margin, yPos);
      
      // Temsilci sayısı badge
      doc.roundedRect(margin + contentWidth - 100, yPos, 80, 25, 12)
         .fillAndStroke('#007bff', '#007bff');
      
      doc.fillColor('#ffffff')
         .fontSize(12)
         .text(`${Object.keys(salesByUser).length} temsilci`, margin + contentWidth - 90, yPos + 8);
      
      yPos += 40;
      
      // Tüm temsilcilerin listesi - sistemdeki kart formatında
      const allPerformers = Object.entries(salesByUser)
        .sort((a, b) => b[1].count - a[1].count);
      
      allPerformers.forEach(([name, data], index) => {
        const performanceCardHeight = 60;
        
        // Kart arka planı
        doc.roundedRect(margin, yPos, contentWidth, performanceCardHeight, 8)
           .fillAndStroke('#ffffff', '#e9ecef');
        
        // Sıralama numarası (renkli daire)
        let circleColor = '#007bff';
        if (index === 0) circleColor = '#ffc107'; // 1. altın
        if (index === 1) circleColor = '#6c757d'; // 2. gümüş
        if (index === 2) circleColor = '#fd7e14'; // 3. bronz
        
        doc.circle(margin + 25, yPos + 30, 20)
           .fillAndStroke(circleColor, circleColor);
        
        doc.fillColor('#ffffff')
           .fontSize(12)
           .text((index + 1).toString(), margin + 20, yPos + 25);
        
        // Top badge
        if (index < 3) {
          doc.roundedRect(margin + 50, yPos + 10, 50, 18, 9)
             .fillAndStroke(circleColor, circleColor);
          
          doc.fillColor('#ffffff')
             .fontSize(8)
             .text(`Top ${index + 1}`, margin + 60, yPos + 16);
        }
        
        // Temsilci bilgileri
        doc.fillColor('#2c3e50')
           .fontSize(14)
           .text(name.toUpperCase(), margin + 110, yPos + 15);
        
        // Email (örnek)
        doc.fillColor('#6c757d')
           .fontSize(9)
           .text(`${name.toLowerCase().replace(' ', '')}@molaistanbul.com`, margin + 110, yPos + 32);
        
        // Satış sayısı (sağ üst)
        doc.fillColor('#007bff')
           .fontSize(16)
           .text(`${data.count} satış`, margin + contentWidth - 150, yPos + 15);
        
        // Toplam tutar (sağ alt)
        doc.fillColor('#6c757d')
           .fontSize(10)
           .text(`₺${data.amount.toLocaleString('tr-TR')}`, margin + contentWidth - 150, yPos + 35);
        
        // Net Prim tutarı (en sağ)
        doc.fillColor('#28a745')
           .fontSize(14)
           .text(`₺${(data.netPrimAmount || data.primAmount || 0).toLocaleString('tr-TR')}`, margin + contentWidth - 80, yPos + 20);
        
        doc.fillColor('#6c757d')
           .fontSize(8)
           .text('Net Prim', margin + contentWidth - 60, yPos + 40);
        
        yPos += performanceCardHeight + 10;
        
        // Sayfa sonu kontrolü
        if (yPos > pageHeight - 100 && index < allPerformers.length - 1) {
          doc.addPage();
          yPos = margin;
        }
      });
      
      yPos += 20;

      // Son sayfa için footer
      if (yPos < pageHeight - 100) {
        yPos = pageHeight - 80;
      }

      // Alt bilgi
      doc.rect(margin, yPos, contentWidth, 50)
         .fillAndStroke('#2c3e50', '#2c3e50');
      
      doc.fillColor('#ffffff')
         .fontSize(12)
         .text('MOLA PRİM SİSTEMİ', margin + 20, yPos + 15, { 
           width: contentWidth - 40, 
           align: 'center' 
         });
      
      doc.fontSize(10)
         .text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Saat: ${new Date().toLocaleTimeString('tr-TR')}`, 
               margin + 20, yPos + 32, { 
                 width: contentWidth - 40, 
                 align: 'center' 
         });

      // PDF'yi sonlandır
      doc.end();
    }
    
  } catch (error) {
    console.error('❌ Export report error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({ 
      message: 'Rapor export edilirken hata oluştu',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/reports/daily-report
// @desc    Detaylı günlük rapor - tüm hareketler ve istatistikler
// @access  Private
router.get('/daily-report', auth, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    // Seçilen tarihin başlangıç ve bitiş saatleri
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    console.log(`📊 Daily report for ${date}:`, { startDate, endDate });

    // Satış verileri
    const salesData = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'salesperson',
          foreignField: '_id',
          as: 'salesperson'
        }
      },
      {
        $addFields: {
          salesperson: { $arrayElemAt: ['$salesperson', 0] }
        }
      },
      {
        $group: {
          _id: '$saleType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$listPrice' },
          totalPrim: { $sum: '$primAmount' },
          sales: {
            $push: {
              _id: '$_id',
              customerName: '$customerName',
              phone: '$phone',
              blockNo: '$blockNo',
              apartmentNo: '$apartmentNo',
              listPrice: '$listPrice',
              activitySalePrice: '$activitySalePrice',
              primAmount: '$primAmount',
              salesperson: '$salesperson.name',
              createdAt: '$createdAt',
              saleType: '$saleType'
            }
          }
        }
      }
    ]);

    // İletişim verileri
    const CommunicationRecord = require('../models/CommunicationRecord');
    const communicationData = await CommunicationRecord.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          user: { $arrayElemAt: ['$user', 0] }
        }
      },
      {
        $group: {
          _id: '$user._id',
          userName: { $first: '$user.name' },
          totalCalls: { $sum: '$totalCalls' },
          whatsappCount: { $sum: '$whatsappCount' },
          totalContacts: { $sum: '$totalContacts' },
          newCustomers: { $sum: '$newCustomers' },
          records: {
            $push: {
              totalCalls: '$totalCalls',
              whatsappCount: '$whatsappCount',
              totalContacts: '$totalContacts',
              newCustomers: '$newCustomers',
              date: '$date'
            }
          }
        }
      }
    ]);

    // Günlük istatistikler
    const dailyStats = {
      totalSales: salesData.reduce((sum, item) => sum + item.count, 0),
      totalRevenue: salesData.reduce((sum, item) => sum + item.totalAmount, 0),
      totalPrim: salesData.reduce((sum, item) => sum + item.totalPrim, 0),
      totalCommunications: communicationData.reduce((sum, item) => sum + item.totalCalls, 0),
      totalWhatsApp: communicationData.reduce((sum, item) => sum + item.whatsappCount, 0),
      totalContacts: communicationData.reduce((sum, item) => sum + item.totalContacts, 0),
      totalNewCustomers: communicationData.reduce((sum, item) => sum + item.newCustomers, 0),
      activeUsers: communicationData.length
    };

    // Satış türlerine göre dağılım
    const salesByType = {};
    salesData.forEach(item => {
      salesByType[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
        totalPrim: item.totalPrim,
        sales: item.sales
      };
    });

    // En aktif kullanıcılar
    const topUsers = communicationData
      .sort((a, b) => (b.totalCalls + b.whatsappCount) - (a.totalCalls + a.whatsappCount))
      .slice(0, 5);

    // Saatlik dağılım (satışlar)
    const hourlyDistribution = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$listPrice' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        date,
        dailyStats,
        salesByType,
        communicationData,
        topUsers,
        hourlyDistribution,
        salesData,
        summary: {
          totalTransactions: dailyStats.totalSales + dailyStats.totalCommunications,
          averageRevenuePerSale: dailyStats.totalSales > 0 ? dailyStats.totalRevenue / dailyStats.totalSales : 0,
          communicationEfficiency: dailyStats.totalContacts > 0 ? (dailyStats.totalSales / dailyStats.totalContacts * 100) : 0
        }
      }
    });

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Günlük rapor oluşturulurken hata oluştu' 
    });
  }
});

module.exports = router;
