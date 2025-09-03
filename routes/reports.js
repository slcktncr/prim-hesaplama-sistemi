const express = require('express');
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
    
    // Admin değilse sadece kendi verilerini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    }

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
    
    // Admin değilse sadece kendi verilerini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    } else if (salesperson) {
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
      query.primPeriod = period;
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
      { $group: { _id: '$paymentType', count: { $sum: 1 }, totalAmount: { $sum: '$basePrimPrice' } } },
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

    res.json({
      activeSales: activeSales[0] || { count: 0, totalListPrice: 0, totalActivityPrice: 0, totalBasePrimPrice: 0, totalPrimAmount: 0, paidPrims: 0, unpaidPrims: 0 },
      cancelledSales: cancelledSales[0] || { count: 0, totalListPrice: 0, totalActivityPrice: 0, totalBasePrimPrice: 0, totalPrimAmount: 0 },
      paymentTypeDistribution,
      monthlySales
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
      query.primPeriod = period;
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
    
    // Admin değilse sadece kendi verilerini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    }

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
        
        return {
          period: period.name,
          periodId: period._id,
          activeSales: activeSales[0]?.count || 0,
          cancelledSales,
          totalAmount: activeSales[0]?.totalAmount || 0,
          totalPrim: activeSales[0]?.totalPrim || 0,
          paidPrims: activeSales[0]?.paidPrims || 0
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
    
    // Admin değilse sadece kendi verilerini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    }
    
    // Dönem filtresi
    if (period) {
      query.primPeriod = period;
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
    
    // Admin değilse sadece kendi verilerini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    } else if (salesperson) {
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
      query.primPeriod = period;
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
    
    let query = {};
    
    // Admin değilse sadece kendi verilerini export edebilir
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    } else if (scope === 'salesperson' && salesperson && salesperson !== 'all') {
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
        query.primPeriod = period;
      }
    }
    
    // Satışları getir
    const sales = await Sale.find(query)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .sort({ saleDate: -1 });
    
    // Export formatına göre data hazırla
    const exportData = sales.map(sale => ({
      'Müşteri Adı': sale.customerName,
      'Blok/Daire': `${sale.blockNo}/${sale.apartmentNo}`,
      'Dönem No': sale.periodNo,
      'Satış Tarihi': new Date(sale.saleDate).toLocaleDateString('tr-TR'),
      'Sözleşme No': sale.contractNo,
      'Liste Fiyatı': sale.listPrice.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
      'Aktivite Satış Fiyatı': sale.activitySalePrice.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
      'Ödeme Tipi': sale.paymentType,
      'Prim Tutarı': sale.primAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
      'Prim Durumu': sale.primStatus === 'ödendi' ? 'Ödendi' : 'Ödenmedi',
      'Temsilci': sale.salesperson?.name || 'Bilinmiyor',
      'Prim Dönemi': sale.primPeriod?.name || 'Bilinmiyor',
      'Durum': sale.status === 'active' ? 'Aktif' : 'İptal'
    }));
    
    // Simülasyon - gerçek export için xlsx kütüphanesi gerekir
    res.json({
      message: `${type.toUpperCase()} raporu başarıyla hazırlandı`,
      filename: `prim_raporu_${Date.now()}.${type === 'excel' ? 'xlsx' : 'pdf'}`,
      recordCount: exportData.length,
      data: type === 'excel' ? exportData : null // PDF için data gönderilmez
    });
    
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ message: 'Rapor export edilirken hata oluştu' });
  }
});

module.exports = router;
