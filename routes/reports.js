const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const Sale = require('../models/Sale');
const PrimTransaction = require('../models/PrimTransaction');
const User = require('../models/User');
const PrimPeriod = require('../models/PrimPeriod');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/reports/dashboard
// @desc    Dashboard özet bilgileri
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    let query = {};
    
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

    // Bu ayki satışlar
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const thisMonthSales = await Sale.countDocuments({
      ...query,
      status: 'aktif',
      saleDate: { $gte: currentMonth }
    });

    // Prim durumları
    const paidPrims = await Sale.countDocuments({ ...query, status: 'aktif', primStatus: 'ödendi' });
    const unpaidPrims = await Sale.countDocuments({ ...query, status: 'aktif', primStatus: 'ödenmedi' });

    // En başarılı temsilciler (sadece admin için) - Farklı kategorilerde
    let topPerformers = {
      salesCount: [], // Satış adeti liderleri
      salesAmount: [], // Satış tutarı liderleri
      primAmount: [] // Prim tutarı liderleri
    };

    if (req.user.role === 'admin') {
      const baseQuery = { status: 'aktif', saleType: 'satis' }; // Sadece normal satışlar
      
      // Satış adeti liderleri
      const salesCountLeaders = await Sale.aggregate([
        { $match: baseQuery },
        { $group: { 
          _id: '$salesperson', 
          count: { $sum: 1 }, 
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' }
        } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { 
          name: '$user.name', 
          email: '$user.email',
          count: 1, 
          totalAmount: 1, 
          totalPrim: 1,
          avgAmount: { $divide: ['$totalAmount', '$count'] }
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
          totalPrim: { $sum: '$primAmount' }
        } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { 
          name: '$user.name', 
          email: '$user.email',
          count: 1, 
          totalAmount: 1, 
          totalPrim: 1,
          avgAmount: { $divide: ['$totalAmount', '$count'] }
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
          totalPrim: { $sum: '$primAmount' }
        } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { 
          name: '$user.name', 
          email: '$user.email',
          count: 1, 
          totalAmount: 1, 
          totalPrim: 1,
          avgAmount: { $divide: ['$totalAmount', '$count'] }
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
      topPerformers
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

    // Aktif satışlar
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

    // İptal edilen satışlar
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

    // Aylık satış trendi
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

    res.json({
      activeSales: activeSales[0] || { count: 0, totalListPrice: 0, totalActivityPrice: 0, totalBasePrimPrice: 0, totalPrimAmount: 0, paidPrims: 0, unpaidPrims: 0 },
      cancelledSales: cancelledSales[0] || { count: 0, totalListPrice: 0, totalActivityPrice: 0, totalBasePrimPrice: 0, totalPrimAmount: 0 },
      paymentTypeDistribution,
      monthlySales,
      successRateData: {
        totalSalesCount,      // Toplam giriş (kapora + normal + iptal)
        realSalesCount,       // Gerçek satış (aktif + kapora olmayan)
        kaporaSalesCount,     // Kapora durumundaki
        cancelledCount: cancelledSales[0]?.count || 0, // İptal edilenler
        successRate: parseFloat(successRate.toFixed(1)) // Başarı oranı
      }
    });
  } catch (error) {
    console.error('Sales summary error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/salesperson-performance
// @desc    Temsilci performans raporu
// @access  Private (Admin only)
router.get('/salesperson-performance', [auth, adminAuth], async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Salesperson Performance Query Params:', { startDate, endDate, period });
    }
    
    let query = {};
    
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Salesperson Performance MongoDB Query:', JSON.stringify(query, null, 2));
    }

    // Temsilci performansları
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
      { $sort: { totalSales: -1 } }
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

    // Performans verilerini birleştir
    const combinedPerformance = performance.map(perf => {
      const cancelled = cancelledSalesPerformance.find(c => c._id.toString() === perf._id.toString());
      return {
        ...perf,
        cancelledSales: cancelled?.cancelledSales || 0,
        cancelledAmount: cancelled?.cancelledAmount || 0
      };
    });

    res.json(combinedPerformance);
  } catch (error) {
    console.error('Salesperson performance error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/period-comparison
// @desc    Dönem karşılaştırma raporu
// @access  Private
router.get('/period-comparison', auth, async (req, res) => {
  try {
    let query = {};
    
    // Tüm kullanıcılar tüm verileri görebilir (sadece görüntüleme için)

    // Son 6 ayın dönemlerini al
    const periods = await PrimPeriod.find({ isActive: true })
      .sort({ year: -1, month: -1 })
      .limit(6);

    const periodComparison = await Promise.all(
      periods.map(async (period) => {
        const periodQuery = { ...query, primPeriod: period._id };
        
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
        
        return {
          period: period.name,
          periodId: period._id,
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
      })
    );

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

    const topPerformers = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$salesperson',
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$basePrimPrice' },
          totalPrim: { $sum: '$primAmount' },
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
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          totalSales: 1,
          totalAmount: 1,
          totalPrim: 1,
          avgSaleAmount: 1
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json(topPerformers);
  } catch (error) {
    console.error('Top performers error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/reports/detailed-report
// @desc    Detaylı rapor (Excel export için)
// @access  Private
router.get('/detailed-report', auth, async (req, res) => {
  try {
    const { startDate, endDate, salesperson, status = 'aktif', period } = req.query;
    
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
    const { type, scope, period, salesperson } = req.body;
    
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
    
    // Satışları getir
    const sales = await Sale.find(query)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .sort({ saleDate: -1 });
    
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
        ['Toplam Satış Tutarı:', sales.reduce((sum, s) => sum + (s.basePrimPrice || s.listPrice || 0), 0)],
        [''],
        ['TEMSİLCİ PERFORMANSI']
      ];

      // Temsilci performans verilerini ekle
      const salesByUser = {};
      sales.forEach(sale => {
        const userName = sale.salesperson?.name || 'Bilinmiyor';
        if (!salesByUser[userName]) {
          salesByUser[userName] = { count: 0, amount: 0, primAmount: 0 };
        }
        salesByUser[userName].count++;
        salesByUser[userName].amount += (sale.basePrimPrice || sale.listPrice || 0);
        salesByUser[userName].primAmount += (sale.primAmount || 0);
      });

      Object.entries(salesByUser)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([name, data]) => {
          summaryData.push([name, `${data.count} satış`, `${data.amount.toLocaleString('tr-TR')} ₺`, `${data.primAmount.toLocaleString('tr-TR')} ₺ prim`]);
        });

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Özet');

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

      // 3. TEMSİLCİ BAZLI ÖZET
      const salesmanData = Object.entries(salesByUser).map(([name, data]) => ({
        'Temsilci Adı': name,
        'Toplam Satış': data.count,
        'Toplam Ciro': data.amount,
        'Toplam Prim': data.primAmount,
        'Ortalama Satış': Math.round(data.amount / data.count),
        'Ortalama Prim': Math.round(data.primAmount / data.count),
        'Prim Oranı': `%${((data.primAmount / data.amount) * 100).toFixed(2)}`
      }));

      const salesmanWs = XLSX.utils.json_to_sheet(salesmanData);
      salesmanWs['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];

      // Para formatı
      const salesmanRange = XLSX.utils.decode_range(salesmanWs['!ref']);
      for (let row = 1; row <= salesmanRange.e.r; row++) {
        [2, 3, 4, 5].forEach(col => { // Ciro ve prim sütunları
          const cell = XLSX.utils.encode_cell({ r: row, c: col });
          if (salesmanWs[cell]) {
            salesmanWs[cell].t = 'n';
            if (col === 2 || col === 3 || col === 4 || col === 5) {
              salesmanWs[cell].z = '#,##0"₺"';
            }
          }
        });
      }

      XLSX.utils.book_append_sheet(wb, salesmanWs, 'Temsilci Analizi');

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

      // Excel buffer oluştur
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      // Dosya adı oluştur
      const fileName = `prim_raporu_detayli_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Response headers ayarla
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Length', excelBuffer.length);
      
      // Excel dosyasını gönder
      res.send(excelBuffer);
      
    } else {
      // PDF export - yatay format ile gelişmiş PDF oluştur
      const doc = new PDFDocument({ 
        layout: 'landscape', // Yatay format
        margin: 30,
        size: 'A4'
      });
      
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

      // Sayfa boyutları (landscape A4)
      const pageWidth = 842;
      const pageHeight = 595;
      const margin = 30;
      const contentWidth = pageWidth - (margin * 2);

      // PDF içeriği oluştur
      let yPos = margin;

      // Başlık bölümü
      doc.fontSize(18)
         .text('MOLA PRİM SİSTEMİ RAPORU', margin, yPos, { 
           align: 'center', 
           width: contentWidth 
         });
      yPos += 30;

      doc.fontSize(10)
         .text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, margin, yPos, { align: 'left' })
         .text(`Toplam Kayıt: ${sales.length}`, margin + 200, yPos)
         .text(`Toplam Tutar: ${sales.reduce((sum, s) => sum + s.listPrice, 0).toLocaleString('tr-TR')} ₺`, margin + 400, yPos);
      yPos += 20;

      // Çizgi
      doc.moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).stroke();
      yPos += 15;

      // Özet istatistikler kutusu
      const statsHeight = 60;
      doc.rect(margin, yPos, contentWidth, statsHeight)
         .stroke();

      // İstatistikler
      const totalSales = sales.length;
      const activeSales = sales.filter(s => s.status === 'aktif').length;
      const paidPrims = sales.filter(s => s.primStatus === 'ödendi').length;
      const totalPrimAmount = sales.reduce((sum, s) => sum + s.primAmount, 0);

      doc.fontSize(9);
      doc.text('ÖZET İSTATİSTİKLER', margin + 10, yPos + 10, { width: 150 });
      doc.text(`Toplam Satış: ${totalSales}`, margin + 10, yPos + 25);
      doc.text(`Aktif Satış: ${activeSales}`, margin + 10, yPos + 40);

      doc.text(`Ödenen Primler: ${paidPrims}`, margin + 200, yPos + 25);
      doc.text(`Toplam Prim: ${totalPrimAmount.toLocaleString('tr-TR')} ₺`, margin + 200, yPos + 40);

      // Temsilci performans özeti
      const salesByUser = {};
      sales.forEach(sale => {
        const userName = sale.salesperson?.name || 'Bilinmiyor';
        if (!salesByUser[userName]) {
          salesByUser[userName] = { count: 0, amount: 0 };
        }
        salesByUser[userName].count++;
        salesByUser[userName].amount += sale.primAmount;
      });

      const topPerformers = Object.entries(salesByUser)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);

      doc.text('EN İYİ PERFORMANS', margin + 400, yPos + 10, { width: 150 });
      topPerformers.forEach((performer, index) => {
        doc.text(`${index + 1}. ${performer[0]}: ${performer[1].count} satış`, margin + 400, yPos + 25 + (index * 12));
      });

      yPos += statsHeight + 20;

      // Tablo başlıkları - yatay formata uygun
      const columnWidths = [90, 60, 40, 70, 80, 80, 80, 70, 60, 90, 80];
      const headers = [
        'Müşteri Adı', 'Blok/Daire', 'Dönem', 'Satış Tarihi', 'Sözleşme No',
        'Liste Fiyatı', 'Satış Fiyatı', 'Prim Tutarı', 'Durum', 'Temsilci', 'Prim Dönemi'
      ];

      // Tablo başlık arka planı
      doc.rect(margin, yPos, contentWidth, 20)
         .fillAndStroke('#f0f0f0', '#000000');

      doc.fillColor('#000000')
         .fontSize(8);

      let xPos = margin + 5;
      headers.forEach((header, index) => {
        doc.text(header, xPos, yPos + 6, { 
          width: columnWidths[index] - 10, 
          align: 'center' 
        });
        xPos += columnWidths[index];
      });

      yPos += 25;

      // Veri satırları
      sales.forEach((sale, index) => {
        // Sayfa sonu kontrolü
        if (yPos > pageHeight - 100) {
          doc.addPage();
          yPos = margin;
        }

        // Alternatif satır rengi
        if (index % 2 === 1) {
          doc.rect(margin, yPos, contentWidth, 18)
             .fill('#f9f9f9');
        }

        doc.fillColor('#000000')
           .fontSize(7);

        const rowData = [
          sale.customerName.substring(0, 15),
          `${sale.blockNo}/${sale.apartmentNo}`,
          sale.periodNo.toString(),
          new Date(sale.saleDate).toLocaleDateString('tr-TR'),
          sale.contractNo.substring(0, 12),
          `${(sale.listPrice / 1000).toFixed(0)}K`,
          `${(sale.activitySalePrice / 1000).toFixed(0)}K`,
          `${(sale.primAmount / 1000).toFixed(0)}K`,
          sale.primStatus === 'ödendi' ? 'Ödendi' : 'Bekliyor',
          sale.salesperson?.name?.substring(0, 15) || 'Bilinmiyor',
          sale.primPeriod?.name?.substring(0, 12) || 'Belirsiz'
        ];

        xPos = margin + 5;
        rowData.forEach((data, colIndex) => {
          doc.text(data, xPos, yPos + 4, { 
            width: columnWidths[colIndex] - 10, 
            align: colIndex >= 5 && colIndex <= 7 ? 'right' : 'left'
          });
          xPos += columnWidths[colIndex];
        });

        yPos += 18;
      });

      // Alt özet
      yPos += 20;
      doc.moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).stroke();
      yPos += 15;

      const totalAmount = sales.reduce((sum, sale) => sum + (sale.listPrice || 0), 0);
      const totalPrim = sales.reduce((sum, sale) => sum + (sale.primAmount || 0), 0);

      doc.fontSize(10);
      doc.text(`Toplam Satış Tutarı: ${totalAmount.toLocaleString('tr-TR')} ₺`, margin, yPos);
      doc.text(`Toplam Prim Tutarı: ${totalPrim.toLocaleString('tr-TR')} ₺`, margin + 250, yPos);
      doc.text(`Aktif Satış Oranı: %${((activeSales / totalSales) * 100).toFixed(1)}`, margin + 500, yPos);

      // Alt bilgi
      yPos += 30;
      doc.fontSize(8)
         .text('MOLA Prim Sistemi - Otomatik Rapor', margin, yPos, { 
           align: 'center', 
           width: contentWidth 
         })
         .text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, margin, yPos + 15, { 
           align: 'center', 
           width: contentWidth 
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

module.exports = router;
