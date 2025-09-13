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

// @route   POST /api/prims/periods/bulk
// @desc    Toplu prim dönemi oluştur
// @access  Private (Admin only)
router.post('/periods/bulk', [auth, adminAuth], [
  body('periods').isArray({ min: 1 }).withMessage('En az bir dönem seçilmelidir'),
  body('periods.*.month').isInt({ min: 1, max: 12 }).withMessage('Ay 1-12 arasında olmalıdır'),
  body('periods.*.year').isInt({ min: 2020, max: 2050 }).withMessage('Geçerli bir yıl giriniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { periods } = req.body;

    // Ay adları
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    // Dönem adlarını oluştur ve mevcut dönemleri kontrol et
    const periodData = periods.map(p => ({
      name: `${monthNames[p.month - 1]} ${p.year}`,
      month: parseInt(p.month),
      year: parseInt(p.year),
      createdBy: req.user._id
    }));

    // Mevcut dönemleri kontrol et
    const existingPeriods = await PrimPeriod.find({
      name: { $in: periodData.map(p => p.name) }
    }).select('name');

    const existingNames = existingPeriods.map(p => p.name);
    const newPeriods = periodData.filter(p => !existingNames.includes(p.name));
    const skippedPeriods = periodData.filter(p => existingNames.includes(p.name));

    console.log(`🔄 Toplu dönem oluşturma:`, {
      requested: periodData.length,
      existing: skippedPeriods.length,
      toCreate: newPeriods.length
    });

    let createdPeriods = [];
    
    if (newPeriods.length > 0) {
      // Yeni dönemleri toplu oluştur
      const insertedPeriods = await PrimPeriod.insertMany(newPeriods);
      
      // Populate edilmiş versiyonları al
      createdPeriods = await PrimPeriod.find({
        _id: { $in: insertedPeriods.map(p => p._id) }
      }).populate('createdBy', 'name').sort({ year: -1, month: -1 });
    }

    const summary = {
      total: periodData.length,
      created: createdPeriods.length,
      skipped: skippedPeriods.length,
      createdPeriods: createdPeriods,
      skippedPeriods: skippedPeriods.map(p => p.name)
    };

    console.log(`✅ Toplu dönem oluşturma tamamlandı:`, summary);

    if (createdPeriods.length === 0) {
      return res.status(200).json({
        message: 'Seçilen tüm dönemler zaten mevcut',
        summary
      });
    }

    const message = skippedPeriods.length > 0 
      ? `${createdPeriods.length} dönem oluşturuldu, ${skippedPeriods.length} dönem zaten mevcuttu`
      : `${createdPeriods.length} dönem başarıyla oluşturuldu`;

    res.status(201).json({
      message,
      summary
    });
  } catch (error) {
    console.error('Bulk create periods error:', error);
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
// @desc    Temsilci prim hakedişlerini getir (satış tarihine göre)
// @access  Private
router.get('/earnings', auth, async (req, res) => {
  try {
    console.log('🔍 Earnings endpoint called');
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
    
    let query = {};
    
    // Tüm kullanıcılar tüm hakedişleri görebilir (sadece görüntüleme için)
    if (salesperson && salesperson !== '') {
      query.salesperson = new mongoose.Types.ObjectId(salesperson);
    }
    
    // Dönem filtresi
    if (period && period !== '') {
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }
    
    console.log('📊 Final query:', query);

    // Satışları doğrudan saleDate'e göre gruplamak için yeni yaklaşım
    console.log('🔄 Earnings calculation - Using saleDate-based grouping');
    
    // Basit yaklaşım: Satışları saleDate'e göre grupla
    const earnings = await Sale.aggregate([
      { 
        $match: { 
          status: 'aktif',
          saleType: { $ne: 'kapora' }, // Kapora hariç
          ...(req.user.role !== 'admin' ? { salesperson: req.user._id } : {}),
          ...(salesperson ? { salesperson: new mongoose.Types.ObjectId(salesperson) } : {}),
          ...(period ? { 
            $expr: {
              $and: [
                { $eq: [{ $year: '$saleDate' }, { $year: { $dateFromString: { dateString: period } } }] },
                { $eq: [{ $month: '$saleDate' }, { $month: { $dateFromString: { dateString: period } } }] }
              ]
            }
          } : {})
        }
      },
      {
        $addFields: {
          saleDateYear: { $year: '$saleDate' },
          saleDateMonth: { $month: '$saleDate' }
        }
      },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            year: '$saleDateYear',
            month: '$saleDateMonth'
          },
          sales: { $push: '$$ROOT' },
          totalSales: { $sum: 1 },
          totalPrimAmount: { $sum: '$primAmount' },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$primStatus', 'ödendi'] }, '$primAmount', 0] }
          },
          unpaidAmount: {
            $sum: { $cond: [{ $eq: ['$primStatus', 'ödenmedi'] }, '$primAmount', 0] }
          }
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
          periodName: {
            $concat: [
              { $arrayElemAt: [
                ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
                { $subtract: ['$_id.month', 1] }
              ]},
              ' ',
              { $toString: '$_id.year' }
            ]
          }
        }
      },
      // Kesintileri de ekle (tüm dönemlerden)
      {
        $lookup: {
          from: 'primtransactions',
          let: { 
            salespersonId: '$_id.salesperson',
            currentYear: '$_id.year',
            currentMonth: '$_id.month'
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
                        { $eq: ['$deductionStatus', 'yapıldı'] },
                        { $and: [
                          { $eq: ['$deductionStatus', null] },
                          { $lt: ['$createdAt', new Date('2024-01-01')] }
                        ]}
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
                isCurrentPeriodDeduction: {
                  $and: [
                    { $eq: [{ $year: { $ifNull: [{ $dateFromString: { dateString: { $arrayElemAt: ['$deductionPeriod.name', 0] } } }, new Date()] } }, '$$currentYear'] },
                    { $eq: [{ $month: { $ifNull: [{ $dateFromString: { dateString: { $arrayElemAt: ['$deductionPeriod.name', 0] } } }, new Date()] } }, '$$currentMonth'] }
                  ]
                }
              }
            }
          ],
          as: 'deductionTransactions'
        }
      },
      // Bekleyen kesintileri de ekle
      {
        $lookup: {
          from: 'primtransactions',
          let: { 
            salespersonId: '$_id.salesperson'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$salesperson', '$$salespersonId'] },
                    { $eq: ['$transactionType', 'kesinti'] },
                    { $eq: ['$deductionStatus', 'beklemede'] }
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
            }
          ],
          as: 'pendingDeductions'
        }
      },
      // Kesinti transaction'larını da getir (tüm dönemlerden)
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
                        { $eq: ['$deductionStatus', 'yapıldı'] },
                        { $and: [
                          { $eq: ['$deductionStatus', null] },
                          { $lt: ['$createdAt', new Date('2024-01-01')] } // Eski kesintiler onaylanmış sayılsın
                        ]}
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
          as: 'deductionTransactions'
        }
      },
      // Bekleyen kesintileri de getir (onay bekleyen)
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
          salesCount: '$totalSales', // Zaten hesaplandı
          // paidAmount ve unpaidAmount zaten hesaplandı
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
    console.error('❌ Get prim earnings error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

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
      query.salesperson = new mongoose.Types.ObjectId(salesperson);
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

module.exports = router;
