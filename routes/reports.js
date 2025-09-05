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
      // PDF export - kapsamlı rapor
      const doc = new PDFDocument({ 
        layout: 'portrait',
        margin: 40,
        size: 'A4'
      });
      
      // Türkçe karakter desteği için font ayarla
      doc.registerFont('Arial', 'Helvetica');
      doc.font('Arial');
      
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

      // Sayfa boyutları (portrait A4)
      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      // PDF içeriği oluştur
      let yPos = margin;

      // Ana başlık
      doc.fontSize(20)
         .fillColor('#2c3e50')
         .text('MOLA PRİM SİSTEMİ', margin, yPos, { 
           align: 'center', 
           width: contentWidth 
         });
      yPos += 25;
      
      doc.fontSize(16)
         .fillColor('#34495e')
         .text('DETAYLI RAPOR ANALİZİ', margin, yPos, { 
           align: 'center', 
           width: contentWidth 
         });
      yPos += 30;
      
      // Rapor bilgi kutusu
      doc.rect(margin, yPos, contentWidth, 60)
         .fillAndStroke('#ecf0f1', '#bdc3c7');
      
      doc.fillColor('#2c3e50')
         .fontSize(10);
      
      const reportDate = new Date().toLocaleDateString('tr-TR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      doc.text(`Rapor Tarihi: ${reportDate}`, margin + 10, yPos + 10);
      doc.text(`Rapor Saati: ${new Date().toLocaleTimeString('tr-TR')}`, margin + 10, yPos + 25);
      doc.text(`Toplam Kayıt Sayısı: ${sales.length}`, margin + 10, yPos + 40);
      
      const reportTotalAmount = sales.reduce((sum, s) => sum + (s.basePrimPrice || s.listPrice || 0), 0);
      const reportTotalPrimAmount = sales.reduce((sum, s) => sum + (s.primAmount || 0), 0);
      
      doc.text(`Toplam Ciro: ${reportTotalAmount.toLocaleString('tr-TR')} ₺`, margin + 280, yPos + 10);
      doc.text(`Toplam Prim: ${reportTotalPrimAmount.toLocaleString('tr-TR')} ₺`, margin + 280, yPos + 25);
      doc.text(`Ortalama Prim: ${sales.length > 0 ? (reportTotalPrimAmount / sales.length).toLocaleString('tr-TR') : '0'} ₺`, margin + 280, yPos + 40);
      
      yPos += 80;

      // 1. GENEL İSTATİSTİKLER BÖLÜMÜ
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('1. GENEL İSTATİSTİKLER', margin, yPos);
      yPos += 25;
      
      const activeSales = sales.filter(s => s.status === 'aktif');
      const cancelledSales = sales.filter(s => s.status === 'iptal');
      const kaporaSales = sales.filter(s => s.saleType === 'kapora');
      const paidPrims = sales.filter(s => s.primStatus === 'ödendi');
      const unpaidPrims = sales.filter(s => s.primStatus === 'ödenmedi');
      
      // İstatistik kutuları
      const statBoxHeight = 80;
      const statBoxWidth = (contentWidth - 20) / 3;
      
      // Aktif satışlar kutusu
      doc.rect(margin, yPos, statBoxWidth, statBoxHeight)
         .fillAndStroke('#e8f5e8', '#27ae60');
      doc.fillColor('#27ae60')
         .fontSize(16)
         .text(activeSales.length.toString(), margin + 10, yPos + 15, { width: statBoxWidth - 20, align: 'center' });
      doc.fillColor('#2c3e50')
         .fontSize(10)
         .text('Aktif Satışlar', margin + 10, yPos + 35, { width: statBoxWidth - 20, align: 'center' });
      doc.text(`${activeSales.reduce((sum, s) => sum + (s.basePrimPrice || 0), 0).toLocaleString('tr-TR')} ₺`, 
               margin + 10, yPos + 50, { width: statBoxWidth - 20, align: 'center' });
      
      // İptal edilen satışlar kutusu
      doc.rect(margin + statBoxWidth + 10, yPos, statBoxWidth, statBoxHeight)
         .fillAndStroke('#ffeaa7', '#e17055');
      doc.fillColor('#e17055')
         .fontSize(16)
         .text(cancelledSales.length.toString(), margin + statBoxWidth + 20, yPos + 15, { width: statBoxWidth - 20, align: 'center' });
      doc.fillColor('#2c3e50')
         .fontSize(10)
         .text('İptal Edilen', margin + statBoxWidth + 20, yPos + 35, { width: statBoxWidth - 20, align: 'center' });
      doc.text(`${cancelledSales.reduce((sum, s) => sum + (s.basePrimPrice || 0), 0).toLocaleString('tr-TR')} ₺`, 
               margin + statBoxWidth + 20, yPos + 50, { width: statBoxWidth - 20, align: 'center' });
      
      // Kapora satışlar kutusu
      doc.rect(margin + (statBoxWidth + 10) * 2, yPos, statBoxWidth, statBoxHeight)
         .fillAndStroke('#dda0dd', '#8e44ad');
      doc.fillColor('#8e44ad')
         .fontSize(16)
         .text(kaporaSales.length.toString(), margin + (statBoxWidth + 10) * 2 + 10, yPos + 15, { width: statBoxWidth - 20, align: 'center' });
      doc.fillColor('#2c3e50')
         .fontSize(10)
         .text('Kapora Durumu', margin + (statBoxWidth + 10) * 2 + 10, yPos + 35, { width: statBoxWidth - 20, align: 'center' });
      
      yPos += statBoxHeight + 30;
      
      // 2. TEMSİLCİ PERFORMANSI
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('2. TEMSİLCİ PERFORMANS ANALİZİ', margin, yPos);
      yPos += 25;
      
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
      
      const sortedPerformers = Object.entries(salesByUser)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);
      
      // Performans tablosu başlık
      doc.rect(margin, yPos, contentWidth, 20)
         .fillAndStroke('#3498db', '#2980b9');
      doc.fillColor('#ffffff')
         .fontSize(9)
         .text('Temsilci', margin + 5, yPos + 6, { width: 120 })
         .text('Satış Sayısı', margin + 130, yPos + 6, { width: 80, align: 'center' })
         .text('Toplam Ciro', margin + 220, yPos + 6, { width: 100, align: 'center' })
         .text('Toplam Prim', margin + 330, yPos + 6, { width: 100, align: 'center' })
         .text('Ortalama', margin + 440, yPos + 6, { width: 70, align: 'center' });
      
      yPos += 25;
      
      // Performans verileri
      sortedPerformers.forEach((performer, index) => {
        const [name, data] = performer;
        const avgSale = data.count > 0 ? (data.amount / data.count) : 0;
        
        // Alternatif satır rengi
        if (index % 2 === 0) {
          doc.rect(margin, yPos, contentWidth, 18)
             .fill('#f8f9fa');
        }
        
        doc.fillColor('#2c3e50')
           .fontSize(8)
           .text(name.substring(0, 18), margin + 5, yPos + 5, { width: 120 })
           .text(data.count.toString(), margin + 130, yPos + 5, { width: 80, align: 'center' })
           .text(`${(data.amount / 1000).toFixed(0)}K ₺`, margin + 220, yPos + 5, { width: 100, align: 'center' })
           .text(`${(data.primAmount / 1000).toFixed(0)}K ₺`, margin + 330, yPos + 5, { width: 100, align: 'center' })
           .text(`${(avgSale / 1000).toFixed(0)}K ₺`, margin + 440, yPos + 5, { width: 70, align: 'center' });
        
        yPos += 20;
      });
      
      yPos += 20;

      // Yeni sayfa ekle
      doc.addPage();
      yPos = margin;
      
      // 3. BAŞARI ORANI ANALİZİ
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('3. BAŞARI ORANI ANALİZİ', margin, yPos);
      yPos += 25;
      
      const totalSalesCount = sales.length;
      const realSalesCount = sales.filter(s => s.status === 'aktif' && s.saleType !== 'kapora').length;
      const successRate = totalSalesCount > 0 ? ((realSalesCount / totalSalesCount) * 100) : 0;
      
      // Başarı oranı kutusu
      doc.rect(margin, yPos, contentWidth, 100)
         .fillAndStroke('#e8f5e8', '#27ae60');
      
      doc.fillColor('#27ae60')
         .fontSize(32)
         .text(`%${successRate.toFixed(1)}`, margin + 50, yPos + 30, { width: 200, align: 'center' });
      
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .text('GENEL BAŞARI ORANI', margin + 50, yPos + 75, { width: 200, align: 'center' });
      
      // Detay bilgileri
      doc.fontSize(11)
         .text(`Toplam Giriş: ${totalSalesCount}`, margin + 300, yPos + 20)
         .text(`Gerçek Satış: ${realSalesCount}`, margin + 300, yPos + 40)
         .text(`Kapora: ${kaporaSales.length}`, margin + 300, yPos + 60)
         .text(`İptal: ${cancelledSales.length}`, margin + 300, yPos + 80);
      
      yPos += 120;
      
      // 4. ÖDEME TİPİ DAĞILIMI
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('4. ÖDEME TİPİ DAĞILIMI', margin, yPos);
      yPos += 25;
      
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
      
      Object.entries(paymentData)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([type, data], index) => {
          const percentage = ((data.count / sales.length) * 100).toFixed(1);
          
          // Ödeme tipi çubuğu
          const barWidth = (data.count / sales.length) * (contentWidth - 200);
          
          doc.rect(margin, yPos, 150, 25)
             .fillAndStroke('#ecf0f1', '#bdc3c7');
          
          doc.rect(margin + 160, yPos, barWidth, 25)
             .fillAndStroke('#3498db', '#2980b9');
          
          doc.fillColor('#2c3e50')
             .fontSize(9)
             .text(type, margin + 5, yPos + 8, { width: 140 })
             .text(`${data.count} (${percentage}%)`, margin + 165, yPos + 8)
             .text(`${(data.amount / 1000).toFixed(0)}K ₺`, margin + 400, yPos + 8, { width: 80, align: 'right' });
          
          yPos += 30;
        });
      
      yPos += 20;

      // Yeni sayfa ekle - Özet
      doc.addPage();
      yPos = margin;
      
      // 5. GENEL ÖZET
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('5. GENEL ÖZET VE ANALİZ', margin, yPos);
      yPos += 30;
      
      // Özet kutusu
      doc.rect(margin, yPos, contentWidth, 150)
         .fillAndStroke('#f8f9fa', '#dee2e6');
      
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .text('RAPOR ÖZETİ', margin + 20, yPos + 20);
      
      const summaryTotalAmount = sales.reduce((sum, sale) => sum + (sale.basePrimPrice || sale.listPrice || 0), 0);
      const summaryTotalPrimAmount = sales.reduce((sum, sale) => sum + (sale.primAmount || 0), 0);
      const avgSaleAmount = sales.length > 0 ? (summaryTotalAmount / sales.length) : 0;
      const avgPrimAmount = sales.length > 0 ? (summaryTotalPrimAmount / sales.length) : 0;
      
      doc.fontSize(10)
         .text(`📊 Toplam Kayıt Sayısı: ${sales.length}`, margin + 20, yPos + 45)
         .text(`💰 Toplam Ciro: ${summaryTotalAmount.toLocaleString('tr-TR')} ₺`, margin + 20, yPos + 65)
         .text(`🎯 Toplam Prim: ${summaryTotalPrimAmount.toLocaleString('tr-TR')} ₺`, margin + 20, yPos + 85)
         .text(`📈 Ortalama Satış: ${avgSaleAmount.toLocaleString('tr-TR')} ₺`, margin + 20, yPos + 105)
         .text(`🏆 Başarı Oranı: %${successRate.toFixed(1)}`, margin + 20, yPos + 125);
      
      // Sağ taraf - Durum dağılımı
      doc.text(`✅ Aktif Satışlar: ${activeSales.length}`, margin + 300, yPos + 45)
         .text(`⏳ Kapora Durumu: ${kaporaSales.length}`, margin + 300, yPos + 65)
         .text(`❌ İptal Edilenler: ${cancelledSales.length}`, margin + 300, yPos + 85)
         .text(`💵 Ödenen Primler: ${paidPrims.length}`, margin + 300, yPos + 105)
         .text(`⏰ Bekleyen Primler: ${unpaidPrims.length}`, margin + 300, yPos + 125);
      
      yPos += 170;
      
      // Notlar ve açıklamalar
      doc.fontSize(9)
         .fillColor('#7f8c8d')
         .text('RAPOR AÇIKLAMALARI:', margin, yPos)
         .text('• Bu rapor sistemdeki tüm satış verilerini kapsamaktadır', margin, yPos + 15)
         .text('• Başarı oranı = Gerçek satışlar / Toplam giriş kayıtları', margin, yPos + 30)
         .text('• Kapora durumundaki satışlar henüz gerçek satışa dönüşmemiş kayıtlardır', margin, yPos + 45)
         .text('• Detaylı veri analizi için Excel raporunu indirebilirsiniz', margin, yPos + 60);
      
      yPos += 90;
      
      // Alt bilgi kutusu
      doc.rect(margin, yPos, contentWidth, 40)
         .fillAndStroke('#2c3e50', '#2c3e50');
      
      doc.fillColor('#ffffff')
         .fontSize(10)
         .text('MOLA PRİM SİSTEMİ - DETAYLI RAPOR', margin + 20, yPos + 12, { 
           width: contentWidth - 40, 
           align: 'center' 
         })
         .text(`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR', { 
           weekday: 'long', 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         })}`, margin + 20, yPos + 25, { 
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

module.exports = router;
