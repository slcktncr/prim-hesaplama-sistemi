const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const PrimRate = require('../models/PrimRate');
const PrimPeriod = require('../models/PrimPeriod');
const PrimTransaction = require('../models/PrimTransaction');
const Sale = require('../models/Sale');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/prims/rate
// @desc    Aktif prim oranını getir
// @access  Private
router.get('/rate', auth, async (req, res) => {
  try {
    const currentRate = await PrimRate.findOne({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    if (!currentRate) {
      return res.status(404).json({ message: 'Aktif prim oranı bulunamadı' });
    }

    console.log('📊 Mevcut prim oranı getiriliyor:');
    console.log('currentRate.rate:', currentRate.rate);
    console.log('typeof currentRate.rate:', typeof currentRate.rate);

    res.json(currentRate);
  } catch (error) {
    console.error('Get prim rate error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/prims/rate
// @desc    Yeni prim oranı belirle
// @access  Private (Admin only)
router.post('/rate', [auth, adminAuth], [
  body('rate').isFloat({ min: 0, max: 100 }).withMessage('Prim oranı 0 ile 100 arasında olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rate } = req.body;
    
    console.log('🔍 Prim oranı güncelleme:');
    console.log('Frontend\'den gelen rate:', rate);
    console.log('parseFloat(rate):', parseFloat(rate));
    console.log('typeof parseFloat(rate):', typeof parseFloat(rate));

    // Eski oranı pasif yap
    await PrimRate.updateMany({ isActive: true }, { isActive: false });

    // Yeni oran oluştur
    const newRate = new PrimRate({
      rate: parseFloat(rate),
      createdBy: req.user._id
    });

    await newRate.save();
    
    console.log('💾 Kaydedilen prim oranı:');
    console.log('newRate.rate:', newRate.rate);
    console.log('typeof newRate.rate:', typeof newRate.rate);

    const populatedRate = await PrimRate.findById(newRate._id)
      .populate('createdBy', 'name');
      
    console.log('📖 Veritabanından okunan:');
    console.log('populatedRate.rate:', populatedRate.rate);
    console.log('typeof populatedRate.rate:', typeof populatedRate.rate);

    res.status(201).json({
      message: 'Prim oranı başarıyla güncellendi',
      rate: populatedRate
    });
  } catch (error) {
    console.error('Create prim rate error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/prims/periods
// @desc    Prim dönemlerini listele
// @access  Private
router.get('/periods', auth, async (req, res) => {
  try {
    const periods = await PrimPeriod.find({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ year: -1, month: -1 });

    res.json(periods);
  } catch (error) {
    console.error('Get prim periods error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/prims/periods
// @desc    Yeni prim dönemi oluştur
// @access  Private (Admin only)
router.post('/periods', [auth, adminAuth], [
  body('name').trim().notEmpty().withMessage('Dönem adı gereklidir'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Ay 1-12 arasında olmalıdır'),
  body('year').isInt({ min: 2020, max: 2050 }).withMessage('Geçerli bir yıl giriniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, month, year } = req.body;

    // Aynı dönem var mı kontrol et
    const existingPeriod = await PrimPeriod.findOne({ name });
    if (existingPeriod) {
      return res.status(400).json({ message: 'Bu dönem zaten mevcut' });
    }

    const period = new PrimPeriod({
      name,
      month: parseInt(month),
      year: parseInt(year),
      createdBy: req.user._id
    });

    await period.save();

    const populatedPeriod = await PrimPeriod.findById(period._id)
      .populate('createdBy', 'name');

    res.status(201).json({
      message: 'Prim dönemi başarıyla oluşturuldu',
      period: populatedPeriod
    });
  } catch (error) {
    console.error('Create prim period error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/prims/transactions
// @desc    Prim işlemlerini listele
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, salesperson, period, type } = req.query;
    
    let query = {};
    
    // Tüm kullanıcılar tüm işlemleri görebilir (sadece görüntüleme için)
    if (salesperson && salesperson !== '') {
      query.salesperson = new mongoose.Types.ObjectId(salesperson);
    }
    
    // Dönem filtresi
    if (period && period !== '') {
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }
    
    // İşlem tipi filtresi
    if (type) {
      query.transactionType = type;
    }

    const transactions = await PrimTransaction.find(query)
      .populate('salesperson', 'name email')
      .populate('sale', 'contractNo customerName')
      .populate('primPeriod', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PrimTransaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get prim transactions error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/prims/earnings
// @desc    Temsilci prim hakedişlerini getir
// @access  Private
router.get('/earnings', auth, async (req, res) => {
  try {
    // Mevcut kesintilerin deductionStatus'unu güncelle (migration)
    const updateResult = await PrimTransaction.updateMany(
      { 
        transactionType: 'kesinti',
        deductionStatus: { $exists: false }
      },
      { 
        $set: { deductionStatus: 'yapıldı' } // Mevcut kesintiler onaylanmış sayılsın
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`📊 Updated ${updateResult.modifiedCount} existing deductions to 'yapıldı' status`);
    }
    
    // Debug: Bekleyen kesintileri database'de kontrol et
    const pendingDeductionsInDB = await PrimTransaction.find({
      transactionType: 'kesinti',
      deductionStatus: 'beklemede'
    }).populate('salesperson', 'name');
    
    console.log('🔍 Pending deductions in database:', {
      count: pendingDeductionsInDB.length,
      deductions: pendingDeductionsInDB.map(d => ({
        id: d._id,
        salesperson: d.salesperson?.name,
        amount: d.amount,
        status: d.deductionStatus
      }))
    });
    
    const { period, salesperson } = req.query;
    console.log('🔍 Earnings request:', { period, salesperson, userRole: req.user.role });
    console.log('🔍 Full req.query:', req.query);
    
    let query = {};
    
    // Temsilci filtresi (user name ile)
    let salespersonFilter = {};
    if (salesperson && salesperson !== '') {
      const User = require('../models/User');
      const user = await User.findOne({ 
        name: salesperson,
        isActive: true,
        isApproved: true
      });
      
      if (user) {
        salespersonFilter.salesperson = user._id;
        console.log('✅ Salesperson found for earnings:', user.name, '→', user._id);
        console.log('✅ Salesperson ObjectId type:', typeof user._id, user._id.constructor.name);
      } else {
        console.log('❌ Salesperson not found for earnings:', salesperson);
        console.log('❌ Available users in database:');
        const allUsers = await User.find({ isActive: true, isApproved: true }).select('name');
        console.log('❌ Users:', allUsers.map(u => u.name));
        return res.status(400).json({ 
          message: `Temsilci bulunamadı: ${salesperson}` 
        });
      }
    }
    
    // Sale kayıtlarını saleDate'e göre gruplama yap
    const Sale = require('../models/Sale');
    
    // Backend'de tüm satışları getir, dönem filtresi frontend'de uygulanacak
    const salesQuery = {
      status: 'aktif',
      saleType: 'satis', // Sadece satışlar, kapora değil
      saleDate: { $exists: true, $ne: null },
      ...salespersonFilter
      // periodFilter kaldırıldı - tüm satışları getir
    };
    
    console.log('📅 Period filter removed - getting all sales, period filter will be applied on frontend');
    if (period && period !== '') {
      console.log('📅 Selected period (for frontend filtering):', period);
    }
    
    console.log('📊 Sales query for earnings:', salesQuery);
    
    // Debug: Önce kaç satış var kontrol et
    const totalSalesCount = await Sale.countDocuments(salesQuery);
    console.log('🔢 Total sales matching query:', totalSalesCount);
    
    // Debug: İlk 5 satışı kontrol et
    const sampleSales = await Sale.find(salesQuery)
      .select('customerName saleDate primAmount salesperson')
      .populate('salesperson', 'name')
      .limit(5);
    console.log('📋 Sample sales:', sampleSales.map(s => ({
      customer: s.customerName,
      saleDate: s.saleDate,
      primAmount: s.primAmount,
      salesperson: s.salesperson?.name
    })));
    
    // Sale kayıtlarını saleDate'e göre grupla
    console.log('🔄 Starting aggregation...');
    
    // Önce basit match test et
    const matchTest = await Sale.aggregate([
      { 
        $match: salesQuery
      },
      { $limit: 1 }
    ]);
    console.log('✅ Match test passed, sample:', matchTest[0]);
    
    const earnings = await Sale.aggregate([
      { 
        $match: salesQuery
      },
      {
        $addFields: {
          saleYear: { $year: '$saleDate' },
          saleMonth: { $month: '$saleDate' }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            year: '$saleYear',
            month: '$saleMonth'
          },
          totalEarnings: { $sum: '$primAmount' },
          transactionCount: { $sum: 1 }, // Satış adedi
          kazancCount: { $sum: 1 }, // Tüm satışlar kazanç
          kesintiCount: { $sum: 0 }, // Kesinti yok (ayrı hesaplanacak)
          transferGelenCount: { $sum: 0 },
          transferGidenCount: { $sum: 0 },
          paidCount: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödendi'] }, 1, 0] } },
          unpaidCount: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödenmedi'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.salesperson',
          foreignField: '_id',
          as: 'salesperson'
        }
      },
      {
        $addFields: {
          // Dönem bilgisini oluştur
          primPeriod: {
            name: {
              $concat: [
                {
                  $arrayElemAt: [
                    ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
                    { $subtract: ['$_id.month', 1] }
                  ]
                },
                ' ',
                { $toString: '$_id.year' }
              ]
            },
            month: '$_id.month',
            year: '$_id.year'
          }
        }
      },
      {
        $project: {
          salesperson: { $arrayElemAt: ['$salesperson', 0] },
          primPeriod: 1,
          totalEarnings: 1,
          transactionCount: 1,
          kazancCount: 1,
          kesintiCount: 1,
          transferGelenCount: 1,
          transferGidenCount: 1,
          paidCount: 1,
          unpaidCount: 1
        }
      },
      {
        $sort: { 
          'primPeriod.year': -1, 
          'primPeriod.month': -1, 
          'salesperson.name': 1 
        }
      }
    ]);
    
    console.log('✅ Earnings result count:', earnings.length);
    console.log('📊 Sample earnings:', earnings.slice(0, 2));
    
    // Debug: Her dönem için detay
    earnings.forEach((earning, index) => {
      if (index < 3) { // İlk 3 sonucu detaylı göster
        console.log(`📈 Earning ${index + 1}:`, {
          salesperson: earning.salesperson?.name,
          period: earning.primPeriod?.name,
          transactionCount: earning.transactionCount,
          totalEarnings: earning.totalEarnings,
          year: earning.primPeriod?.year,
          month: earning.primPeriod?.month
        });
      }
    });

    res.json(earnings);
  } catch (error) {
    console.error('Get prim earnings error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      message: 'Sunucu hatası',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Eski earnings endpoint kodu burada başlıyor (silinecek)
/*
      {
        $lookup: {
          from: 'primtransactions',
          let: { 
            salespersonId: '$_id.salesperson',
            currentPeriodId: '$_id.primPeriod'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$salesperson', '$$salespersonId'] },
                    { $eq: ['$transactionType', 'kesinti'] },
                    {
                      $or: [
                        { $eq: ['$deductionStatus', 'beklemede'] },
                        { $eq: ['$deductionStatus', null] },
                        { $not: { $ifNull: ['$deductionStatus', false] } }
                      ]
                    }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'sales',
                localField: 'sale',
                foreignField: '_id',
                as: 'saleDetails'
              }
            },
            {
              $lookup: {
                from: 'primperiods',
                localField: 'primPeriod',
                foreignField: '_id',
                as: 'deductionPeriod'
              }
            },
            {
              $addFields: {
                saleDetails: { $arrayElemAt: ['$saleDetails', 0] },
                deductionPeriod: { $arrayElemAt: ['$deductionPeriod', 0] },
                isCurrentPeriodDeduction: { $eq: ['$primPeriod', '$$currentPeriodId'] },
                isCarriedForward: { $ne: ['$primPeriod', '$$currentPeriodId'] }
              }
            }
          ],
          as: 'pendingDeductions'
        }
      },
      {
        $addFields: {
          salesCount: { $size: '$sales' },
          paidAmount: {
            $sum: {
              $map: {
                input: '$sales',
                as: 'sale',
                in: { $cond: [{ $eq: ['$$sale.primStatus', 'ödendi'] }, '$$sale.primAmount', 0] }
              }
            }
          },
          unpaidAmount: {
            $sum: {
              $map: {
                input: '$sales',
                as: 'sale',
                in: { $cond: [{ $eq: ['$$sale.primStatus', 'ödenmedi'] }, '$$sale.primAmount', 0] }
              }
            }
          },
          totalDeductions: {
            $sum: '$deductionTransactions.amount'
          },
          deductionsCount: { $size: '$deductionTransactions' },
          // Geçmişten devreden kesintiler
          carriedForwardDeductions: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$deductionTransactions',
                    cond: { $eq: ['$$this.isCarriedForward', true] }
                  }
                },
                as: 'deduction',
                in: '$$deduction.amount'
              }
            }
          },
          carriedForwardCount: {
            $size: {
              $filter: {
                input: '$deductionTransactions',
                cond: { $eq: ['$$this.isCarriedForward', true] }
              }
            }
          },
          // Güncel dönem kesintileri
          currentPeriodDeductions: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$deductionTransactions',
                    cond: { $eq: ['$$this.isCurrentPeriodDeduction', true] }
                  }
                },
                as: 'deduction',
                in: '$$deduction.amount'
              }
            }
          },
          currentPeriodDeductionsCount: {
            $size: {
              $filter: {
                input: '$deductionTransactions',
                cond: { $eq: ['$$this.isCurrentPeriodDeduction', true] }
              }
            }
          },
          // Bekleyen kesintiler (amount ve array ayrı tutulmalı)
          pendingDeductionsAmount: {
            $sum: '$pendingDeductions.amount'
          },
          pendingDeductionsCount: { $size: '$pendingDeductions' },
          // Net hakediş hesapla (ödenmemiş primler - mevcut dönemdeki kesintiler)
          netUnpaidAmount: {
            $subtract: [
              {
                $sum: {
                  $map: {
                    input: '$sales',
                    as: 'sale',
                    in: { $cond: [{ $eq: ['$$sale.primStatus', 'ödenmedi'] }, '$$sale.primAmount', 0] }
                  }
                }
              },
              { $abs: { $sum: '$deductionTransactions.amount' } }
            ]
          }
        }
      },
      // Sadece satışı olan dönemler gösterilsin
      {
        $match: {
          salesCount: { $gt: 0 }  // En az 1 satış olmalı
        }
      },
      {
        $project: {
          salesperson: { $arrayElemAt: ['$salesperson', 0] },
          primPeriod: { $arrayElemAt: ['$primPeriod', 0] },
          totalEarnings: 1,
          transactionCount: 1,
          kazancCount: 1,
          kesintiCount: 1,
          transferGelenCount: 1,
          transferGidenCount: 1,
          salesCount: 1,
          paidAmount: 1,
          unpaidAmount: 1,
          totalDeductions: 1,
          deductionsCount: 1,
          carriedForwardDeductions: 1,
          carriedForwardCount: 1,
          currentPeriodDeductions: 1,
          currentPeriodDeductionsCount: 1,
          pendingDeductions: 1,
          pendingDeductionsAmount: 1,
          pendingDeductionsCount: 1,
          netUnpaidAmount: 1,
          deductionTransactions: 1
        }
      },
      {
        $sort: { 'primPeriod.year': -1, 'primPeriod.month': -1, 'salesperson.name': 1 }
      }
    ]);

    console.log('✅ Earnings result count:', earnings.length);
    
    // Debug: Bekleyen kesintileri kontrol et
    if (earnings.length > 0) {
      console.log('📊 Sample earning with pending deductions:', {
        salesperson: earnings[0].salesperson?.name,
        pendingDeductionsCount: earnings[0].pendingDeductionsCount,
        pendingDeductions: earnings[0].pendingDeductions,
        pendingDeductionsType: typeof earnings[0].pendingDeductions,
        pendingDeductionsLength: Array.isArray(earnings[0].pendingDeductions) ? earnings[0].pendingDeductions.length : 'Not array',
        totalDeductions: earnings[0].totalDeductions
      });
      
      // Sıla Pazarlı'yı özel olarak kontrol et
      const silaPazarli = earnings.find(e => e.salesperson?.name?.includes('Sıla'));
      if (silaPazarli) {
        console.log('🎯 Sıla Pazarlı specific data:', {
          name: silaPazarli.salesperson?.name,
          pendingDeductionsCount: silaPazarli.pendingDeductionsCount,
          pendingDeductions: silaPazarli.pendingDeductions,
          pendingDeductionsArray: Array.isArray(silaPazarli.pendingDeductions),
          pendingDeductionsLength: Array.isArray(silaPazarli.pendingDeductions) ? silaPazarli.pendingDeductions.length : 'Not array'
        });
      }
    }

    res.json(earnings);
  } catch (error) {
    console.error('Get prim earnings error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});
*/

// @route   GET /api/prims/deductions
// @desc    Prim kesintilerini getir (prim ödenmiş ama iptal edilmiş satışlar)
// @access  Private
router.get('/deductions', auth, async (req, res) => {
  try {
    const { period, salesperson } = req.query;
    console.log('🔍 Deductions request:', { period, salesperson, userRole: req.user.role });
    
    let query = {
      transactionType: 'kesinti' // Sadece kesinti transaction'ları
    };
    
    // Admin değilse sadece kendi kesintilerini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    } else if (salesperson && salesperson !== '') {
      // User name ile lookup yap (earnings endpoint'i gibi)
      const User = require('../models/User');
      const user = await User.findOne({ 
        name: salesperson,
        isActive: true,
        isApproved: true
      });
      
      if (user) {
        query.salesperson = user._id;
        console.log('✅ Salesperson found for deductions:', user.name, '→', user._id);
      } else {
        console.log('❌ Salesperson not found for deductions:', salesperson);
        return res.status(400).json({ 
          message: `Temsilci bulunamadı: ${salesperson}` 
        });
      }
    }
    
    // Dönem filtresi
    if (period && period !== '') {
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }
    
    console.log('📊 Deductions query:', query);

    // Kesinti transaction'larını getir ve ilgili satışları kontrol et
    const deductions = await PrimTransaction.aggregate([
      { $match: query },
      // İlgili satışı getir
      {
        $lookup: {
          from: 'sales',
          localField: 'sale',
          foreignField: '_id',
          as: 'saleInfo'
        }
      },
      // Sadece iptal edilmiş satışlardan gelen kesintileri al
      {
        $match: {
          'saleInfo.status': 'iptal'
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            primPeriod: '$primPeriod'
          },
          totalDeductions: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          transactions: { $push: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.salesperson',
          foreignField: '_id',
          as: 'salesperson'
        }
      },
      {
        $lookup: {
          from: 'primperiods',
          localField: '_id.primPeriod',
          foreignField: '_id',
          as: 'primPeriod'
        }
      },
      {
        $project: {
          salesperson: { $arrayElemAt: ['$salesperson', 0] },
          primPeriod: { $arrayElemAt: ['$primPeriod', 0] },
          totalDeductions: 1,
          transactionCount: 1,
          transactions: 1
        }
      },
      {
        $sort: { 'primPeriod.year': -1, 'primPeriod.month': -1, 'salesperson.name': 1 }
      }
    ]);

    console.log('✅ Deductions result count:', deductions.length);

    res.json(deductions);
  } catch (error) {
    console.error('Get prim deductions error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/prims/sales/:id/period
// @desc    Satışın prim dönemini değiştir
// @access  Private (Admin only)
router.put('/sales/:id/period', [auth, adminAuth], [
  body('primPeriod').notEmpty().withMessage('Prim dönemi seçilmelidir')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { primPeriod } = req.body;

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Prim ödendiyse değiştirilemez
    if (sale.primStatus === 'ödendi') {
      return res.status(400).json({ message: 'Prim ödenmiş satışların dönemi değiştirilemez' });
    }

    const oldPeriod = sale.primPeriod;
    sale.primPeriod = primPeriod;
    await sale.save();

    // Eski dönemdeki işlemi iptal et
    await PrimTransaction.findOneAndUpdate(
      { sale: sale._id, primPeriod: oldPeriod, transactionType: 'kazanç' },
      { status: 'iptal' }
    );

    // Yeni döneme işlem ekle
    const newTransaction = new PrimTransaction({
      salesperson: sale.salesperson,
      sale: sale._id,
      primPeriod: primPeriod,
      transactionType: 'kazanç',
      amount: sale.primAmount,
      description: `${sale.contractNo} sözleşme dönem değişikliği`,
      createdBy: req.user._id
    });
    await newTransaction.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    res.json({
      message: 'Satış dönemi başarıyla güncellendi',
      sale: updatedSale
    });
  } catch (error) {
    console.error('Update sale period error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/prims/cleanup-duplicate-deductions
// @desc    Yinelenen kesinti transaction'larını temizle
// @access  Private (Admin only)
router.post('/cleanup-duplicate-deductions', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🧹 Duplicate deductions cleanup started by:', req.user?.email);

    // Aynı satış için birden fazla kesinti transaction'ı olan kayıtları bul
    const duplicateDeductions = await PrimTransaction.aggregate([
      {
        $match: {
          transactionType: 'kesinti',
          sale: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$sale',
          count: { $sum: 1 },
          transactions: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    let cleanedCount = 0;
    let totalAmount = 0;

    for (const group of duplicateDeductions) {
      const transactions = group.transactions;
      // En son oluşturulanı koru, diğerlerini sil
      const sortedTransactions = transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const toKeep = sortedTransactions[0];
      const toDelete = sortedTransactions.slice(1);

      console.log(`📋 Sale ${group._id}: ${transactions.length} kesinti bulundu, ${toDelete.length} silinecek`);

      for (const transaction of toDelete) {
        await PrimTransaction.deleteOne({ _id: transaction._id });
        cleanedCount++;
        totalAmount += Math.abs(transaction.amount);
        console.log(`🗑️ Silindi: ${transaction._id} - ${transaction.amount} TL`);
      }

      console.log(`✅ Korundu: ${toKeep._id} - ${toKeep.amount} TL`);
    }

    console.log(`🎯 Cleanup completed: ${cleanedCount} duplicate deductions removed, ${totalAmount} TL cleaned`);

    res.json({
      message: 'Yinelenen kesinti transaction\'ları başarıyla temizlendi',
      cleanedCount,
      totalAmount,
      duplicateGroups: duplicateDeductions.length
    });
  } catch (error) {
    console.error('❌ Cleanup deductions error:', error);
    res.status(500).json({ 
      message: 'Kesinti temizleme işleminde hata oluştu',
      error: error.message 
    });
  }
});

// @route   PUT /api/prims/deductions/:id/approve
// @desc    Kesinti işlemini onayla (hakediş'ten düş)
// @access  Private (Admin only)
router.put('/deductions/:id/approve', [auth, adminAuth], async (req, res) => {
  try {
    const deduction = await PrimTransaction.findById(req.params.id);
    if (!deduction) {
      return res.status(404).json({ message: 'Kesinti bulunamadı' });
    }

    if (deduction.transactionType !== 'kesinti') {
      return res.status(400).json({ message: 'Bu işlem bir kesinti değil' });
    }

    if (deduction.deductionStatus === 'yapıldı') {
      return res.status(400).json({ message: 'Bu kesinti zaten onaylanmış' });
    }

    // Kesinti durumunu "yapıldı" olarak güncelle
    deduction.deductionStatus = 'yapıldı';
    deduction.description += ' (Onaylandı)';
    await deduction.save();

    const updatedDeduction = await PrimTransaction.findById(deduction._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .populate('sale', 'contractNo customerName');

    res.json({
      message: 'Kesinti onaylandı ve hakediş\'ten düşüldü',
      deduction: updatedDeduction
    });
  } catch (error) {
    console.error('Approve deduction error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/prims/deductions/:id/cancel
// @desc    Kesinti işlemini iptal et
// @access  Private (Admin only)
router.put('/deductions/:id/cancel', [auth, adminAuth], async (req, res) => {
  try {
    const deduction = await PrimTransaction.findById(req.params.id);
    if (!deduction) {
      return res.status(404).json({ message: 'Kesinti bulunamadı' });
    }

    if (deduction.transactionType !== 'kesinti') {
      return res.status(400).json({ message: 'Bu işlem bir kesinti değil' });
    }

    if (deduction.deductionStatus === 'yapıldı') {
      return res.status(400).json({ message: 'Onaylanmış kesinti iptal edilemez' });
    }

    // Kesinti durumunu "iptal" olarak güncelle
    deduction.deductionStatus = 'iptal';
    deduction.description += ' (İptal edildi)';
    await deduction.save();

    const updatedDeduction = await PrimTransaction.findById(deduction._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .populate('sale', 'contractNo customerName');

    res.json({
      message: 'Kesinti iptal edildi',
      deduction: updatedDeduction
    });
  } catch (error) {
    console.error('Cancel deduction error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/prims/transactions/:id/status
// @desc    PrimTransaction durumunu güncelle
// @access  Private (Admin only)
router.put('/transactions/:id/status', [
  auth,
  adminAuth,
  body('status').isIn(['paid', 'unpaid', 'deducted', 'not_deducted']).withMessage('Geçersiz durum')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array() 
      });
    }

    const { status } = req.body;
    const transactionId = req.params.id;

    // PrimTransaction'ı bul
    const transaction = await PrimTransaction.findById(transactionId)
      .populate('salesperson', 'name email')
      .populate('sale', 'customerName blockNo apartmentNo');

    if (!transaction) {
      return res.status(404).json({ message: 'İşlem bulunamadı' });
    }

    console.log('🔄 PrimTransaction durum güncelleme:', {
      transactionId,
      currentStatus: transaction.status,
      currentDeductionStatus: transaction.deductionStatus,
      newStatus: status,
      transactionType: transaction.transactionType,
      amount: transaction.amount
    });

    // Durumu güncelle
    if (status === 'paid') {
      // Ek prim ödendi
      transaction.status = 'onaylandı';
      transaction.deductionStatus = undefined;
    } else if (status === 'unpaid') {
      // Ek prim ödenmedi
      transaction.status = 'beklemede';
      transaction.deductionStatus = undefined;
    } else if (status === 'deducted') {
      // Kesinti yapıldı
      transaction.status = 'onaylandı';
      transaction.deductionStatus = 'yapıldı';
    } else if (status === 'not_deducted') {
      // Kesinti yapılmadı
      transaction.status = 'beklemede';
      transaction.deductionStatus = 'beklemede';
    }

    await transaction.save();

    console.log('✅ PrimTransaction durumu güncellendi:', {
      transactionId,
      newStatus: transaction.status,
      newDeductionStatus: transaction.deductionStatus,
      salesperson: transaction.salesperson.name,
      amount: transaction.amount,
      type: transaction.transactionType
    });

    res.json({
      message: 'İşlem durumu başarıyla güncellendi',
      transaction: {
        _id: transaction._id,
        status: transaction.status,
        deductionStatus: transaction.deductionStatus,
        transactionType: transaction.transactionType,
        amount: transaction.amount,
        salesperson: transaction.salesperson,
        sale: transaction.sale
      }
    });

  } catch (error) {
    console.error('PrimTransaction status update error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/prims/earnings-v2
// @desc    Temsilci prim hakedişlerini getir (Satış Primleri + PrimTransaction'lar)
// @access  Private
router.get('/earnings-v2', auth, async (req, res) => {
  try {
    console.log('🔍 Prim earnings v2 request received');
    console.log('Request query:', req.query);

    const { 
      salesperson: salespersonFilter,
      year: yearFilter,
      month: monthFilter
    } = req.query;

    // Admin değilse sadece kendi hakedişlerini görebilir
    const isAdmin = req.user.role?.name === 'admin';
    console.log('🔐 Is admin?', isAdmin);

    // Temsilci filtresi
    let salespersonQuery = {};
    if (salespersonFilter) {
      salespersonQuery = { salesperson: new mongoose.Types.ObjectId(salespersonFilter) };
    } else if (!isAdmin) {
      salespersonQuery = { salesperson: req.user._id };
    }

    // Tarih filtreleri
    let dateQuery = {};
    if (yearFilter && monthFilter) {
      const year = parseInt(yearFilter);
      const month = parseInt(monthFilter);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      dateQuery = { $gte: startOfMonth, $lte: endOfMonth };
    }

    // 1. Satış Primlerini Getir
    let salesQuery = {
      ...salespersonQuery,
      saleType: { $ne: 'kapora' }
    };
    
    if (Object.keys(dateQuery).length > 0) {
      salesQuery.saleDate = dateQuery;
    }

    const salesEarnings = await Sale.aggregate([
      { $match: salesQuery },
      {
        $addFields: {
          saleYear: { $year: '$saleDate' },
          saleMonth: { $month: '$saleDate' }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            year: '$saleYear',
            month: '$saleMonth'
          },
          salesEarnings: { $sum: '$primAmount' },
          salesCount: { $sum: 1 },
          paidSalesCount: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödendi'] }, 1, 0] } },
          unpaidSalesCount: { $sum: { $cond: [{ $eq: ['$primStatus', 'ödenmedi'] }, 1, 0] } }
        }
      }
    ]);

    // 2. PrimTransaction'ları Getir
    let primTransactionQuery = { ...salespersonQuery };
    
    console.log('🔍 PrimTransaction query before date filter:', primTransactionQuery);
    
    // Debug: Tüm PrimTransaction'ları listele
    const allPrimTransactions = await PrimTransaction.find({}).populate('salesperson', 'name').populate('sale', 'saleDate customerName');
    console.log('📋 Tüm PrimTransaction\'lar COUNT:', allPrimTransactions.length);
    
    // Özellikle Anıl'ın transaction'larını bul
    const anilTransactions = allPrimTransactions.filter(pt => 
      pt.salesperson?.name?.includes('Anıl') || pt.salesperson?.name?.includes('ANILA')
    );
    
    console.log('🎯 Anıl\'ın PrimTransaction\'ları:', anilTransactions.map(pt => ({
      id: pt._id,
      salesperson: pt.salesperson?.name,
      transactionType: pt.transactionType,
      amount: pt.amount,
      status: pt.status,
      deductionStatus: pt.deductionStatus,
      sale: {
        customerName: pt.sale?.customerName,
        saleDate: pt.sale?.saleDate
      },
      createdAt: pt.createdAt
    })));
    
    if (anilTransactions.length === 0) {
      console.log('❌ Anıl için hiç PrimTransaction bulunamadı!');
    }

    // PrimTransaction'ları Sale ile join ederek satış tarihine göre filtrele
    const primTransactions = await PrimTransaction.aggregate([
      { $match: primTransactionQuery },
      // Sale bilgilerini getir
      {
        $lookup: {
          from: 'sales',
          localField: 'sale',
          foreignField: '_id',
          as: 'saleInfo'
        }
      },
      {
        $addFields: {
          saleInfo: { $arrayElemAt: ['$saleInfo', 0] }
        }
      },
      // GEÇICI: Tarih filtresini kaldır - debug için
      // ...(Object.keys(dateQuery).length > 0 ? [{
      //   $match: {
      //     'saleInfo.saleDate': dateQuery
      //   }
      // }] : []),
      
      // Debug: Filtrelemeden önce transaction'ları logla
      {
        $addFields: {
          debugInfo: {
            salesperson: '$salesperson',
            transactionType: '$transactionType',
            amount: '$amount',
            status: '$status',
            deductionStatus: '$deductionStatus',
            saleDate: '$saleInfo.saleDate'
          }
        }
      },
      {
        $addFields: {
          // Satış tarihinden yıl ve ay çıkar (PrimTransaction'ın tarihinden değil)
          transactionYear: { $year: '$saleInfo.saleDate' },
          transactionMonth: { $month: '$saleInfo.saleDate' }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            year: '$transactionYear',
            month: '$transactionMonth',
            transactionType: '$transactionType',
            status: '$status',
            deductionStatus: '$deductionStatus'
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📊 Sales earnings count:', salesEarnings.length);
    console.log('📊 PrimTransactions count:', primTransactions.length);
    
    // Debug: PrimTransaction detayları
    console.log('🔍 PrimTransactions details:', primTransactions.map(pt => ({
      salesperson: pt._id.salesperson,
      year: pt._id.year,
      month: pt._id.month,
      type: pt._id.transactionType,
      status: pt._id.status,
      deductionStatus: pt._id.deductionStatus,
      amount: pt.amount,
      count: pt.count
    })));

    // 3. Sonuçları Birleştir
    const earningsMap = new Map();

    // Satış primlerini ekle
    salesEarnings.forEach(earning => {
      const key = `${earning._id.salesperson}_${earning._id.year}_${earning._id.month}`;
      earningsMap.set(key, {
        salesperson: earning._id.salesperson,
        year: earning._id.year,
        month: earning._id.month,
        salesEarnings: earning.salesEarnings || 0,
        salesCount: earning.salesCount || 0,
        paidSalesCount: earning.paidSalesCount || 0,
        unpaidSalesCount: earning.unpaidSalesCount || 0,
        additionalEarnings: 0,
        pendingEarnings: 0,
        deductions: 0,
        pendingDeductions: 0,
        transactionCount: 0
      });
    });

    // PrimTransaction'ları ekle
    primTransactions.forEach(transaction => {
      const key = `${transaction._id.salesperson}_${transaction._id.year}_${transaction._id.month}`;
      
      if (!earningsMap.has(key)) {
        earningsMap.set(key, {
          salesperson: transaction._id.salesperson,
          year: transaction._id.year,
          month: transaction._id.month,
          salesEarnings: 0,
          salesCount: 0,
          paidSalesCount: 0,
          unpaidSalesCount: 0,
          additionalEarnings: 0,
          pendingEarnings: 0,
          deductions: 0,
          pendingDeductions: 0,
          transactionCount: 0
        });
      }

      const earning = earningsMap.get(key);
      earning.transactionCount += transaction.count;

      if (transaction._id.transactionType === 'kazanç') {
        if (transaction._id.status === 'onaylandı') {
          earning.additionalEarnings += transaction.amount;
        } else if (transaction._id.status === 'beklemede') {
          earning.pendingEarnings += transaction.amount;
        }
      } else if (transaction._id.transactionType === 'kesinti') {
        if (transaction._id.deductionStatus === 'yapıldı') {
          earning.deductions += transaction.amount;
        } else if (transaction._id.deductionStatus === 'beklemede') {
          earning.pendingDeductions += transaction.amount;
        }
      }

      // Debug: Bekleyen ödemeler için özel log
      if (transaction._id.status === 'beklemede' && transaction._id.transactionType === 'kazanç') {
        console.log(`🔔 Bekleyen ek ödeme bulundu - ${transaction._id.year}/${transaction._id.month}:`, {
          salesperson: transaction._id.salesperson,
          amount: transaction.amount,
          pendingEarnings: earning.pendingEarnings
        });
      }
    });

    // 4. User bilgilerini ekle ve final result oluştur
    const finalEarnings = [];
    
    for (const earning of earningsMap.values()) {
      try {
        const user = await User.findById(earning.salesperson).select('name email');
        
        // Bekleyen primler de hakediş hesabına dahil edilmeli
        const totalEarnings = earning.salesEarnings + earning.additionalEarnings + earning.pendingEarnings - earning.deductions - earning.pendingDeductions;
        
        console.log(`💰 ${user?.name} - ${earning.month}/${earning.year}:`, {
          salesEarnings: earning.salesEarnings,
          additionalEarnings: earning.additionalEarnings,
          pendingEarnings: earning.pendingEarnings,
          deductions: earning.deductions,
          pendingDeductions: earning.pendingDeductions,
          totalEarnings
        });
        
        finalEarnings.push({
          salesperson: user,
          primPeriod: {
            name: `${['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][earning.month - 1]} ${earning.year}`,
            month: earning.month,
            year: earning.year
          },
          totalEarnings,
          transactionCount: earning.salesCount + earning.transactionCount,
          
          // Detaylar
          salesEarnings: earning.salesEarnings,
          salesCount: earning.salesCount,
          additionalEarnings: earning.additionalEarnings,
          pendingEarnings: earning.pendingEarnings,
          deductions: earning.deductions,
          pendingDeductions: earning.pendingDeductions,
          
          // Eski format uyumluluğu
          kazancCount: earning.salesCount,
          kesintiCount: earning.transactionCount,
          transferGelenCount: 0,
          transferGidenCount: 0,
          paidCount: earning.paidSalesCount,
          unpaidCount: earning.unpaidSalesCount
        });
      } catch (userError) {
        console.error('User lookup error:', userError);
      }
    }

    // Sıralama
    finalEarnings.sort((a, b) => {
      if (a.primPeriod.year !== b.primPeriod.year) {
        return b.primPeriod.year - a.primPeriod.year;
      }
      if (a.primPeriod.month !== b.primPeriod.month) {
        return b.primPeriod.month - a.primPeriod.month;
      }
      return (a.salesperson?.name || '').localeCompare(b.salesperson?.name || '');
    });

    console.log('✅ Final earnings count:', finalEarnings.length);
    if (finalEarnings.length > 0) {
      console.log('📊 Sample final earning:', {
        salesperson: finalEarnings[0].salesperson?.name,
        period: finalEarnings[0].primPeriod?.name,
        salesEarnings: finalEarnings[0].salesEarnings,
        additionalEarnings: finalEarnings[0].additionalEarnings,
        deductions: finalEarnings[0].deductions,
        totalEarnings: finalEarnings[0].totalEarnings
      });
    }

    res.json(finalEarnings);
  } catch (error) {
    console.error('Get prim earnings v2 error:', error);
    res.status(500).json({ 
      message: 'Sunucu hatası',
      error: error.message
    });
  }
});

// @route   GET /api/prims/earnings-simple
// @desc    Basit ve anlaşılır prim hakedişleri
// @access  Private
router.get('/earnings-simple', auth, async (req, res) => {
  try {
    const { salesperson, period, year, month } = req.query;
    
    // Sadece kendi verilerini görebilir (admin hariç)
    let salespersonFilter = {};
    const isAdmin = req.user.role && req.user.role.name === 'admin';
    
    if (!isAdmin) {
      salespersonFilter.salesperson = req.user._id;
    } else if (salesperson && salesperson !== 'all') {
      salespersonFilter.salesperson = salesperson;
    }

    console.log('🎯 Basit hakediş sorgusu:', { 
      salespersonFilter, 
      period, 
      year, 
      month,
      isAdmin,
      userId: req.user._id,
      userName: req.user.name
    });

    // 1. Satışları prim dönemlerine göre grupla (SADECE AKTİF SATIŞLAR)
    const salesByPeriod = await Sale.aggregate([
      { 
        $match: { 
          status: 'aktif',  // Sadece aktif satışlar (kapora değil)
          saleType: { $ne: 'kapora' }, // Kapora tipini hariç tut
          ...salespersonFilter 
        } 
      },
      {
        $lookup: {
          from: 'users',
          localField: 'salesperson',
          foreignField: '_id',
          as: 'salespersonInfo'
        }
      },
      {
        $lookup: {
          from: 'primperiods',
          localField: 'primPeriod',
          foreignField: '_id',
          as: 'periodInfo'
        }
      },
      {
        $addFields: {
          salespersonInfo: { $arrayElemAt: ['$salespersonInfo', 0] },
          periodInfo: { $arrayElemAt: ['$periodInfo', 0] }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            primPeriod: '$primPeriod'
          },
          salespersonName: { $first: '$salespersonInfo.name' },
          periodName: { $first: '$periodInfo.name' },
          salesCount: { $sum: 1 },
          totalSalesAmount: { $sum: '$listPrice' },
          totalCommissions: { $sum: '$primAmount' },
          paidCommissions: { 
            $sum: { 
              $cond: [{ $eq: ['$primStatus', 'ödendi'] }, '$primAmount', 0] 
            } 
          },
          unpaidCommissions: { 
            $sum: { 
              $cond: [{ $eq: ['$primStatus', 'ödenmedi'] }, '$primAmount', 0] 
            } 
          },
          sales: { $push: '$$ROOT' }
        }
      },
      { $sort: { salespersonName: 1, 'periodInfo.name': -1 } }
    ]);

    console.log('📊 Dönemsel satış verileri:', salesByPeriod.length, 'kayıt');
    
    // Debug: İlk birkaç kayıtı logla
    if (salesByPeriod.length > 0) {
      console.log('📋 İlk 3 satış grubu:', salesByPeriod.slice(0, 3).map(s => ({
        salesperson: s.salespersonName,
        period: s.periodName,
        salesCount: s.salesCount,
        totalSales: s.totalSalesAmount,
        totalCommissions: s.totalCommissions
      })));
    }

    // 2. Tüm PrimTransaction'ları temsilciye göre al
    const allTransactionsByUser = await Promise.all(
      [...new Set(salesByPeriod.map(s => s._id.salesperson.toString()))].map(async (salespersonId) => {
        const allTransactions = await PrimTransaction.find({
          salesperson: salespersonId
        }).populate('sale', 'customerName saleDate contractNo primPeriod');
        
        return {
          salespersonId,
          transactions: allTransactions
        };
      })
    );

    // Transaction'ları temsilci ID'ye göre map'e çevir
    const transactionMap = new Map();
    allTransactionsByUser.forEach(({ salespersonId, transactions }) => {
      transactionMap.set(salespersonId, transactions);
    });

    // 3. Her dönem için ek ödemeler ve kesintileri hesapla
    const enrichedEarnings = await Promise.all(
      salesByPeriod.map(async (earning) => {
        // Bu temsilcinin tüm transaction'ları
        const allUserTransactions = transactionMap.get(earning._id.salesperson.toString()) || [];
        
        // Bu dönemdeki satışlarla ilgili transaction'lar
        const periodTransactions = allUserTransactions.filter(t => 
          earning.sales.some(s => s._id.toString() === t.sale?._id?.toString())
        );

        // Bekleyen ödemeler (sadece değişiklik sonrası ek primler) - tüm bekleyen transaction'ları en son döneme dahil et
        const pendingTransactions = allUserTransactions.filter(t => 
          t.transactionType === 'kazanç' && 
          t.status === 'beklemede' &&
          t.description && t.description.includes('değişiklik') // Sadece değişiklik sonrası primler
        );
        
        // Bekleyen ödemeleri BUGÜNE EN YAKIN döneme dahil et
        // Temsilcinin tüm dönemlerini tarih bazında sırala
        const userPeriods = salesByPeriod.filter(s => 
          s._id.salesperson.toString() === earning._id.salesperson.toString()
        );
        
        // PrimPeriod bilgilerini getir ve tarih bazında sırala
        const periodsWithDates = await Promise.all(
          userPeriods.map(async (up) => {
            const periodInfo = await PrimPeriod.findById(up._id.primPeriod);
            return {
              ...up,
              startDate: periodInfo?.startDate || new Date('1900-01-01'),
              endDate: periodInfo?.endDate || new Date('2100-12-31')
            };
          })
        );
        
        // Bugüne en yakın dönemi bul (bugünden sonraki en yakın dönem)
        const today = new Date();
        const futureOrCurrentPeriods = periodsWithDates.filter(p => p.endDate >= today);
        const nearestPeriod = futureOrCurrentPeriods.length > 0 
          ? futureOrCurrentPeriods.sort((a, b) => a.startDate - b.startDate)[0]
          : periodsWithDates.sort((a, b) => b.endDate - a.endDate)[0]; // Eğer gelecek dönem yoksa en son geçmiş dönem
        
        const isNearestPeriod = nearestPeriod && nearestPeriod._id.primPeriod.toString() === earning._id.primPeriod.toString();
        
        // Bekleyen ödemeler sadece bugüne en yakın dönemde gösterilir
        const pendingAmount = isNearestPeriod ? 
          pendingTransactions.reduce((sum, t) => sum + t.amount, 0) : 0;

        // Debug: Bekleyen ödeme varsa logla
        if (pendingAmount > 0) {
          console.log(`🎯 BEKLEYEN ÖDEME BULUNDU - ${earning.salespersonName} - ${earning.periodName}:`, {
            isNearestPeriod,
            nearestPeriodName: nearestPeriod?.periodName,
            currentPeriodName: earning.periodName,
            pendingAmount,
            pendingTransactionsCount: pendingTransactions.length,
            allUserPeriodsWithDates: periodsWithDates.map(p => ({
              name: p.periodName,
              startDate: p.startDate,
              endDate: p.endDate
            }))
          });
        }

        // Kesintiler (sadece iptal edilen satışlar ve değişiklik sonrası kesintiler)
        const deductionTransactions = periodTransactions.filter(t => 
          t.transactionType === 'kesinti' && 
          t.description && 
          (t.description.includes('iptal') || t.description.includes('değişiklik')) // Sadece iptal veya değişiklik kesintileri
        );
        const deductionAmount = deductionTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Debug: Kesinti varsa logla
        if (deductionTransactions.length > 0) {
          console.log(`🔴 KESINTI BULUNDU - ${earning.salespersonName} - ${earning.periodName}:`, {
            deductionAmount,
            deductionTransactionsCount: deductionTransactions.length,
            deductionTransactions: deductionTransactions.map(t => ({
              amount: t.amount,
              status: t.status,
              deductionStatus: t.deductionStatus,
              description: t.description,
              saleCustomerName: t.sale?.customerName
            }))
          });
        }

        // Debug: Transaction'ları logla
        if (pendingAmount > 0 || deductionAmount > 0) {
          console.log(`💰 ${earning.salespersonName} - ${earning.periodName}:`, {
            isNearestPeriod,
            pendingAmount,
            deductionAmount,
            pendingTransactions: pendingTransactions.length
          });
        }

        // Net hakediş
        const netAmount = earning.totalCommissions + pendingAmount - deductionAmount;

        // Ödeme durumu
        const status = earning.unpaidCommissions > 0 || pendingAmount > 0 ? 'pending' : 'paid';

        return {
          salespersonId: earning._id.salesperson,
          salespersonName: earning.salespersonName,
          periodId: earning._id.primPeriod,
          periodName: earning.periodName,
          salesCount: earning.salesCount,
          totalSalesAmount: earning.totalSalesAmount,
          totalCommissions: earning.totalCommissions,
          paidCommissions: earning.paidCommissions,
          unpaidCommissions: earning.unpaidCommissions,
          pendingAmount,
          deductionAmount,
          netAmount,
          status,
          transactions: pendingTransactions.concat(periodTransactions).map(t => ({
            id: t._id,
            type: t.transactionType,
            amount: t.amount,
            status: t.status,
            deductionStatus: t.deductionStatus,
            description: t.description,
            createdAt: t.createdAt,
            sale: {
              customerName: t.sale?.customerName,
              contractNo: t.sale?.contractNo,
              saleDate: t.sale?.saleDate
            }
          }))
        };
      })
    );

    console.log('💰 Zenginleştirilmiş hakediş verileri:', enrichedEarnings.length, 'kayıt');
    
    // Debug: Bekleyen ödemesi olan kayıtları özellikle logla
    const recordsWithPending = enrichedEarnings.filter(e => e.pendingAmount > 0);
    if (recordsWithPending.length > 0) {
      console.log('🔔 BEKLEYEN ÖDEMELİ KAYITLAR:', recordsWithPending.map(r => ({
        name: r.salespersonName,
        period: r.periodName,
        pendingAmount: r.pendingAmount
      })));
    } else {
      console.log('❌ Hiçbir kayıtta bekleyen ödeme bulunamadı!');
    }

    res.json(enrichedEarnings);
  } catch (error) {
    console.error('Basit hakediş hatası:', error);
    res.status(500).json({ 
      message: 'Hakediş verileri getirilemedi',
      error: error.message 
    });
  }
});

// @route   GET /api/prims/earnings-clean
// @desc    Temiz prim hakediş sistemi - SIFIRDAN YENİ
// @access  Private
router.get('/earnings-clean', auth, async (req, res) => {
  try {
    const { salesperson, period } = req.query;
    
    // Kullanıcı rolü kontrolü
    let salespersonFilter = {};
    const isAdmin = req.user.role && req.user.role.name === 'admin';
    
    if (!isAdmin) {
      salespersonFilter.salesperson = req.user._id;
    } else if (salesperson && salesperson !== 'all') {
      salespersonFilter.salesperson = salesperson;
    }

    console.log('🆕 TEMİZ PRİM HAKEDİŞ SİSTEMİ - Başlıyor:', { salesperson, period, isAdmin });

    // 1. TEMEL SATIŞ PRİMLERİ - Aktif satışların dönemsel gruplaması
    const salesEarnings = await Sale.aggregate([
      { 
        $match: { 
          status: 'aktif',
          saleType: { $ne: 'kapora' },
          ...salespersonFilter 
        } 
      },
      {
        $lookup: {
          from: 'users',
          localField: 'salesperson',
          foreignField: '_id',
          as: 'salespersonInfo'
        }
      },
      {
        $lookup: {
          from: 'primperiods',
          localField: 'primPeriod',
          foreignField: '_id',
          as: 'periodInfo'
        }
      },
      {
        $addFields: {
          salespersonInfo: { $arrayElemAt: ['$salespersonInfo', 0] },
          periodInfo: { $arrayElemAt: ['$periodInfo', 0] },
          // Değişiklik varsa orijinal prim tutarını hesapla
          originalPrimAmount: {
            $cond: [
              { $and: [
                { $gt: [{ $size: { $ifNull: ['$modificationHistory', []] } }, 0] },
                { $eq: ['$primStatus', 'ödendi'] }
              ]},
              // Eğer değişiklik varsa ve prim ödendiyse, son değişiklikten önceki prim tutarını al
              { 
                $let: {
                  vars: {
                    lastModification: { 
                      $arrayElemAt: ['$modificationHistory', -1] 
                    }
                  },
                  in: { $ifNull: ['$$lastModification.oldPrimAmount', '$primAmount'] }
                }
              },
              // Değişiklik yoksa veya ödenmemişse normal prim tutarı
              '$primAmount'
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            primPeriod: '$primPeriod'
          },
          salespersonName: { $first: '$salespersonInfo.name' },
          salespersonId: { $first: { $toString: '$salesperson' } },
          periodName: { $first: '$periodInfo.name' },
          
          // Temel istatistikler
          salesCount: { $sum: 1 },
          totalSalesAmount: { $sum: '$listPrice' },
          totalCommissions: { $sum: '$primAmount' },
          paidCommissions: { 
            $sum: { 
              $cond: [{ $eq: ['$primStatus', 'ödendi'] }, '$originalPrimAmount', 0] 
            } 
          },
          unpaidCommissions: { 
            $sum: { 
              $cond: [{ $eq: ['$primStatus', 'ödenmedi'] }, '$primAmount', 0] 
            } 
          },
          
          // Detay için satış listesi
          sales: { $push: '$$ROOT' }
        }
      }
    ]);

    console.log('📊 Temel satış primleri:', salesEarnings.length, 'dönem grubu');
    
    // Debug: Sibel Çekmez satışını özellikle kontrol et
    salesEarnings.forEach(earning => {
      const sibelSale = earning.sales?.find(s => s.customerName?.includes('SİBEL') || s.customerName?.includes('ÇEKMEZ'));
      if (sibelSale) {
        console.log('🔍 SİBEL ÇEKMEZ satışı bulundu:', {
          customerName: sibelSale.customerName,
          listPrice: sibelSale.listPrice,
          primAmount: sibelSale.primAmount,
          originalPrimAmount: sibelSale.originalPrimAmount,
          primRate: sibelSale.primRate,
          basePrimPrice: sibelSale.basePrimPrice,
          primStatus: sibelSale.primStatus,
          hasModifications: sibelSale.modificationHistory?.length > 0,
          lastModification: sibelSale.modificationHistory?.[sibelSale.modificationHistory.length - 1],
          salesperson: earning.salespersonName,
          period: earning.periodName,
          saleId: sibelSale._id,
          paidCommissions: earning.paidCommissions,
          totalCommissions: earning.totalCommissions
        });
        
        // Değişiklik sonrası prim farkı kontrolü
        if (sibelSale.modificationHistory?.length > 0 && sibelSale.primStatus === 'ödendi') {
          const lastMod = sibelSale.modificationHistory[sibelSale.modificationHistory.length - 1];
          console.log('💰 SİBEL ÇEKMEZ Prim Farkı Analizi:', {
            oldPrimAmount: lastMod.oldPrimAmount,
            newPrimAmount: lastMod.newPrimAmount,
            primDifference: lastMod.primDifference,
            odenecekEkPrim: lastMod.primDifference > 0 ? lastMod.primDifference : 0,
            kesilecekPrim: lastMod.primDifference < 0 ? Math.abs(lastMod.primDifference) : 0
          });
        }
      }
    });

    // 2. İPTAL KESİNTİLERİ - İptal edilen primi ödenen satışlar
    const cancellationDeductions = await Sale.aggregate([
      {
        $match: {
          status: 'iptal',
          primStatus: 'ödendi',
          ...salespersonFilter
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'salesperson',
          foreignField: '_id',
          as: 'salespersonInfo'
        }
      },
      {
        $lookup: {
          from: 'primperiods',
          localField: 'primPeriod',
          foreignField: '_id',
          as: 'periodInfo'
        }
      },
      {
        $addFields: {
          salespersonInfo: { $arrayElemAt: ['$salespersonInfo', 0] },
          periodInfo: { $arrayElemAt: ['$periodInfo', 0] }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            primPeriod: '$primPeriod'
          },
          salespersonName: { $first: '$salespersonInfo.name' },
          salespersonId: { $first: { $toString: '$salesperson' } },
          periodName: { $first: '$periodInfo.name' },
          
          cancellationCount: { $sum: 1 },
          cancellationAmount: { $sum: '$primAmount' },
          cancelledSales: { $push: '$$ROOT' }
        }
      }
    ]);

    console.log('🚫 İptal kesintileri:', cancellationDeductions.length, 'dönem grubu');

    // 3. DEĞİŞİKLİK FARKLARI - Modification PrimTransaction'ları
    const modificationTransactions = await PrimTransaction.aggregate([
      {
        $match: {
          description: { $regex: 'değişiklik', $options: 'i' },
          ...salespersonFilter
        }
      },
      {
        $lookup: {
          from: 'sales',
          localField: 'sale',
          foreignField: '_id',
          as: 'saleInfo'
        }
      },
      {
        $addFields: {
          saleInfo: { $arrayElemAt: ['$saleInfo', 0] }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'salesperson',
          foreignField: '_id',
          as: 'salespersonInfo'
        }
      },
      {
        $lookup: {
          from: 'primperiods',
          localField: 'primPeriod',
          foreignField: '_id',
          as: 'periodInfo'
        }
      },
      {
        $addFields: {
          salespersonInfo: { $arrayElemAt: ['$salespersonInfo', 0] },
          periodInfo: { $arrayElemAt: ['$periodInfo', 0] }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            primPeriod: '$primPeriod'
          },
          salespersonName: { $first: '$salespersonInfo.name' },
          salespersonId: { $first: { $toString: '$salesperson' } },
          periodName: { $first: '$periodInfo.name' },
          
          // Ek kazançlar (değişiklik sonrası artış)
          additionalEarnings: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$transactionType', 'kazanç'] }, { $eq: ['$status', 'onaylandı'] }] },
                '$amount',
                0
              ]
            }
          },
          
          // Bekleyen ek kazançlar
          pendingEarnings: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$transactionType', 'kazanç'] }, { $eq: ['$status', 'beklemede'] }] },
                '$amount',
                0
              ]
            }
          },
          
          // Değişiklik kesintileri
          modificationDeductions: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$transactionType', 'kesinti'] }, { $eq: ['$status', 'onaylandı'] }] },
                '$amount',
                0
              ]
            }
          },
          
          // Bekleyen kesintiler
          pendingDeductions: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$transactionType', 'kesinti'] }, { $eq: ['$deductionStatus', 'beklemede'] }] },
                '$amount',
                0
              ]
            }
          },
          
          modificationTransactions: { $push: '$$ROOT' }
        }
      }
    ]);

    console.log('🔄 Değişiklik işlemleri:', modificationTransactions.length, 'dönem grubu');

    // 4. VERİLERİ BİRLEŞTİR
    const allEarnings = [];
    const processedKeys = new Set();

    // Temel satış primlerini ekle
    salesEarnings.forEach(earning => {
      const key = `${earning.salespersonId}-${earning._id.primPeriod}`;
      processedKeys.add(key);

      allEarnings.push({
        salespersonId: earning.salespersonId,
        salespersonName: earning.salespersonName,
        periodName: earning.periodName,
        periodId: earning._id.primPeriod,
        
        // Temel primler
        salesCount: earning.salesCount,
        totalSalesAmount: earning.totalSalesAmount,
        totalCommissions: earning.totalCommissions,
        paidCommissions: earning.paidCommissions,
        unpaidCommissions: earning.unpaidCommissions,
        
        // İptal kesintileri (başlangıçta sıfır)
        cancellationCount: 0,
        cancellationAmount: 0,
        
        // Değişiklik farkları (başlangıçta sıfır)
        additionalEarnings: 0,
        pendingEarnings: 0,
        modificationDeductions: 0,
        pendingDeductions: 0,
        
        // Detaylar
        sales: earning.sales,
        cancelledSales: [],
        modificationTransactions: []
      });
    });

    // İptal kesintilerini ekle/güncelle
    cancellationDeductions.forEach(cancellation => {
      const key = `${cancellation.salespersonId}-${cancellation._id.primPeriod}`;
      let earning = allEarnings.find(e => 
        e.salespersonId === cancellation.salespersonId && 
        e.periodId.toString() === cancellation._id.primPeriod.toString()
      );

      if (!earning) {
        // Yeni kayıt oluştur
        earning = {
          salespersonId: cancellation.salespersonId,
          salespersonName: cancellation.salespersonName,
          periodName: cancellation.periodName,
          periodId: cancellation._id.primPeriod,
          salesCount: 0,
          totalSalesAmount: 0,
          totalCommissions: 0,
          paidCommissions: 0,
          unpaidCommissions: 0,
          cancellationCount: 0,
          cancellationAmount: 0,
          additionalEarnings: 0,
          pendingEarnings: 0,
          modificationDeductions: 0,
          pendingDeductions: 0,
          sales: [],
          cancelledSales: [],
          modificationTransactions: []
        };
        allEarnings.push(earning);
        processedKeys.add(key);
      }

      earning.cancellationCount = cancellation.cancellationCount;
      earning.cancellationAmount = cancellation.cancellationAmount;
      earning.cancelledSales = cancellation.cancelledSales;
    });

    // Değişiklik işlemlerini ekle/güncelle - BEKLEYEN ÖDEMELERİ EN YAKIN DÖNEME EKLE
    for (const modification of modificationTransactions) {
      // Bu temsilcinin tüm dönemlerini bul
      const userPeriods = allEarnings.filter(e => 
        e.salespersonId === modification.salespersonId
      );

      if (userPeriods.length === 0) {
        // Bu temsilcinin hiç satışı yoksa yeni kayıt oluştur
        const newEarning = {
          salespersonId: modification.salespersonId,
          salespersonName: modification.salespersonName,
          periodName: modification.periodName,
          periodId: modification._id.primPeriod,
          salesCount: 0,
          totalSalesAmount: 0,
          totalCommissions: 0,
          paidCommissions: 0,
          unpaidCommissions: 0,
          cancellationCount: 0,
          cancellationAmount: 0,
          additionalEarnings: modification.additionalEarnings,
          pendingEarnings: modification.pendingEarnings,
          modificationDeductions: modification.modificationDeductions,
          pendingDeductions: modification.pendingDeductions,
          sales: [],
          cancelledSales: [],
          modificationTransactions: modification.modificationTransactions
        };
        allEarnings.push(newEarning);
        continue;
      }

      // Bu temsilcinin en son dönemini bul (alfabetik olarak en büyük)
      const latestPeriod = userPeriods.sort((a, b) => b.periodName.localeCompare(a.periodName))[0];
      
      // Orijinal dönemde ek kazançlar ve kesintiler ekle
      const originalEarning = allEarnings.find(e => 
        e.salespersonId === modification.salespersonId && 
        e.periodId.toString() === modification._id.primPeriod.toString()
      );

      if (originalEarning) {
        originalEarning.additionalEarnings = modification.additionalEarnings;
        originalEarning.modificationDeductions = modification.modificationDeductions;
        originalEarning.modificationTransactions = modification.modificationTransactions;
      }

      // BEKLEYEN ödemeler/kesintiler en son dönemde gösterilir
      if (modification.pendingEarnings > 0 || modification.pendingDeductions > 0) {
        latestPeriod.pendingEarnings += modification.pendingEarnings;
        latestPeriod.pendingDeductions += modification.pendingDeductions;
        
        console.log(`🎯 BEKLEYEN ÖDEME EN SON DÖNEME EKLENDİ:`, {
          salesperson: modification.salespersonName,
          originalPeriod: modification.periodName,
          latestPeriod: latestPeriod.periodName,
          pendingEarnings: modification.pendingEarnings,
          pendingDeductions: modification.pendingDeductions
        });
      }
    }

    // 5. NET HAKEDİŞ HESAPLA ve SIRAYLA
    const finalEarnings = allEarnings
      .map(earning => {
        // Net hakediş hesaplama
        const grossEarnings = earning.totalCommissions + earning.additionalEarnings;
        const totalDeductions = earning.cancellationAmount + earning.modificationDeductions;
        const netAmount = grossEarnings - totalDeductions;
        
        // Bekleyen tutarlar
        const pendingAmount = earning.pendingEarnings - earning.pendingDeductions;
        
        // Toplam net (mevcut + bekleyen)
        const totalNet = netAmount + pendingAmount;
        
        // Durum
        const hasPending = earning.unpaidCommissions > 0 || earning.pendingEarnings > 0 || earning.pendingDeductions > 0;
        const status = hasPending ? 'pending' : 'paid';

        return {
          ...earning,
          grossEarnings,
          totalDeductions,
          netAmount,
          pendingAmount,
          totalNet,
          status
        };
      })
      .sort((a, b) => {
        // Önce temsilci adına göre sırala
        if (a.salespersonName !== b.salespersonName) {
          return a.salespersonName.localeCompare(b.salespersonName);
        }
        // Sonra dönem adına göre (tersten - yeni dönemler üstte)
        return b.periodName.localeCompare(a.periodName);
      });

    // Debug özeti
    const summary = {
      totalRecords: finalEarnings.length,
      totalSales: finalEarnings.reduce((sum, e) => sum + e.salesCount, 0),
      totalCommissions: finalEarnings.reduce((sum, e) => sum + e.totalCommissions, 0),
      totalCancellations: finalEarnings.reduce((sum, e) => sum + e.cancellationCount, 0),
      totalCancellationAmount: finalEarnings.reduce((sum, e) => sum + e.cancellationAmount, 0),
      totalPendingEarnings: finalEarnings.reduce((sum, e) => sum + e.pendingEarnings, 0),
      totalPendingDeductions: finalEarnings.reduce((sum, e) => sum + e.pendingDeductions, 0)
    };

    console.log('✅ TEMİZ SİSTEM TAMAMLANDI:', summary);

    res.json(finalEarnings);

  } catch (error) {
    console.error('❌ Temiz prim hakediş sistemi hatası:', error);
    res.status(500).json({ 
      message: 'Prim hakediş verileri getirilemedi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/prims/fix-sibel-cekmez
// @desc    Sibel Çekmez satışının prim oranını düzelt
// @access  Private (Admin only)
router.post('/fix-sibel-cekmez', [auth, adminAuth], async (req, res) => {
  try {
    const Sale = require('../models/Sale');
    
    // Sibel Çekmez satışını bul
    const sibelSale = await Sale.findOne({ 
      customerName: { $regex: /SİBEL.*ÇEKMEZ/i } 
    });
    
    if (!sibelSale) {
      return res.status(404).json({ message: 'Sibel Çekmez satışı bulunamadı' });
    }
    
    console.log('🔍 Sibel Çekmez satışı bulundu:', {
      id: sibelSale._id,
      customerName: sibelSale.customerName,
      listPrice: sibelSale.listPrice,
      currentPrimRate: sibelSale.primRate,
      currentPrimAmount: sibelSale.primAmount,
      primStatus: sibelSale.primStatus
    });
    
    // Prim oranını %1'e düzelt ve prim tutarını yeniden hesapla
    const correctPrimRate = 1;
    const correctPrimAmount = sibelSale.listPrice * (correctPrimRate / 100);
    
    // Eski değerleri kaydet
    const oldValues = {
      primRate: sibelSale.primRate,
      primAmount: sibelSale.primAmount
    };
    
    // Yeni değerleri güncelle
    sibelSale.primRate = correctPrimRate;
    sibelSale.primAmount = correctPrimAmount;
    
    await sibelSale.save();
    
    console.log('✅ Sibel Çekmez satışı düzeltildi:', {
      oldPrimRate: oldValues.primRate,
      newPrimRate: correctPrimRate,
      oldPrimAmount: oldValues.primAmount,
      newPrimAmount: correctPrimAmount,
      difference: correctPrimAmount - oldValues.primAmount
    });
    
    res.json({
      message: 'Sibel Çekmez satışının prim oranı başarıyla düzeltildi',
      oldValues,
      newValues: {
        primRate: correctPrimRate,
        primAmount: correctPrimAmount
      },
      sale: sibelSale
    });
    
  } catch (error) {
    console.error('Sibel Çekmez düzeltme hatası:', error);
    res.status(500).json({ 
      message: 'Düzeltme işlemi başarısız',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/prims/fix-transfer-transactions
// @desc    Transfer sonrası PrimTransaction'ları doğru temsilciye ata
// @access  Private (Admin only)
router.post('/fix-transfer-transactions', [auth, adminAuth], async (req, res) => {
  try {
    const Sale = require('../models/Sale');
    const User = require('../models/User');
    
    // Sibel Çekmez satışını bul
    const sibelSale = await Sale.findOne({ 
      customerName: { $regex: /SİBEL.*ÇEKMEZ/i } 
    }).populate('salesperson', 'name email');
    
    if (!sibelSale) {
      return res.status(404).json({ message: 'Sibel Çekmez satışı bulunamadı' });
    }
    
    console.log('🔍 Sibel Çekmez satışı:', {
      id: sibelSale._id,
      customerName: sibelSale.customerName,
      currentSalesperson: sibelSale.salesperson?.name,
      salespersonId: sibelSale.salesperson?._id
    });
    
    // Bu satışla ilgili PrimTransaction'ları bul
    const relatedTransactions = await PrimTransaction.find({ 
      sale: sibelSale._id 
    }).populate('salesperson', 'name email');
    
    console.log('💳 İlgili PrimTransaction\'lar:', {
      count: relatedTransactions.length,
      transactions: relatedTransactions.map(t => ({
        id: t._id,
        salesperson: t.salesperson?.name,
        salespersonId: t.salesperson?._id,
        transactionType: t.transactionType,
        amount: t.amount,
        status: t.status,
        deductionStatus: t.deductionStatus,
        description: t.description
      }))
    });
    
    // Ayrıca tüm Sibel Çekmez ile ilgili transaction'ları bul
    const allSibelTransactions = await PrimTransaction.find({ 
      description: { $regex: /SİBEL.*ÇEKMEZ/i } 
    }).populate('salesperson', 'name email').populate('sale', 'customerName salesperson');
    
    console.log('🔍 Tüm Sibel Çekmez transaction\'ları:', {
      count: allSibelTransactions.length,
      transactions: allSibelTransactions.map(t => ({
        id: t._id,
        salesperson: t.salesperson?.name,
        salespersonId: t.salesperson?._id,
        saleOwner: t.sale?.salesperson,
        transactionType: t.transactionType,
        amount: t.amount,
        status: t.status,
        deductionStatus: t.deductionStatus,
        description: t.description,
        createdAt: t.createdAt
      }))
    });
    
    // Yanlış temsilciye ait transaction'ları düzelt
    const fixedTransactions = [];
    for (const transaction of relatedTransactions) {
      if (transaction.salesperson?._id?.toString() !== sibelSale.salesperson?._id?.toString()) {
        const oldSalespersonName = transaction.salesperson?.name;
        
        console.log(`🔧 Transaction düzeltiliyor: ${transaction._id}`);
        console.log(`   Eski temsilci: ${oldSalespersonName}`);
        console.log(`   Yeni temsilci: ${sibelSale.salesperson?.name}`);
        
        transaction.salesperson = sibelSale.salesperson._id;
        transaction.updatedAt = new Date();
        await transaction.save();
        
        fixedTransactions.push({
          id: transaction._id,
          oldSalesperson: oldSalespersonName,
          newSalesperson: sibelSale.salesperson?.name,
          amount: transaction.amount,
          type: transaction.transactionType
        });
      }
    }
    
    res.json({
      message: 'PrimTransaction transfer düzeltmesi tamamlandı',
      sale: {
        id: sibelSale._id,
        customerName: sibelSale.customerName,
        salesperson: sibelSale.salesperson?.name
      },
      fixedTransactions,
      totalFixed: fixedTransactions.length
    });
    
  } catch (error) {
    console.error('Fix transfer transactions error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
