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
  body('rate').isFloat({ min: 0, max: 1 }).withMessage('Prim oranı 0 ile 1 arasında olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rate } = req.body;

    // Eski oranı pasif yap
    await PrimRate.updateMany({ isActive: true }, { isActive: false });

    // Yeni oran oluştur
    const newRate = new PrimRate({
      rate: parseFloat(rate),
      createdBy: req.user._id
    });

    await newRate.save();

    const populatedRate = await PrimRate.findById(newRate._id)
      .populate('createdBy', 'name');

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
    
    // Admin değilse sadece kendi işlemlerini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    } else if (salesperson && salesperson !== '') {
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
    const { period, salesperson } = req.query;
    console.log('🔍 Earnings request:', { period, salesperson, userRole: req.user.role });
    
    let query = {};
    
    // Admin değilse sadece kendi hakedişini görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    } else if (salesperson && salesperson !== '') {
      query.salesperson = new mongoose.Types.ObjectId(salesperson);
    }
    
    // Dönem filtresi
    if (period && period !== '') {
      query.primPeriod = new mongoose.Types.ObjectId(period);
    }
    
    console.log('📊 Final query:', query);

    // Aggregate pipeline ile hakedişleri hesapla
    const earnings = await PrimTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            salesperson: '$salesperson',
            primPeriod: '$primPeriod'
          },
          totalEarnings: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          kazancCount: {
            $sum: { $cond: [{ $eq: ['$transactionType', 'kazanç'] }, 1, 0] }
          },
          kesintiCount: {
            $sum: { $cond: [{ $eq: ['$transactionType', 'kesinti'] }, 1, 0] }
          },
          transferGelenCount: {
            $sum: { $cond: [{ $eq: ['$transactionType', 'transfer_gelen'] }, 1, 0] }
          },
          transferGidenCount: {
            $sum: { $cond: [{ $eq: ['$transactionType', 'transfer_giden'] }, 1, 0] }
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
        $lookup: {
          from: 'primperiods',
          localField: '_id.primPeriod',
          foreignField: '_id',
          as: 'primPeriod'
        }
      },
      // Satış bilgilerini de ekle
      {
        $lookup: {
          from: 'sales',
          let: { 
            salespersonId: '$_id.salesperson', 
            periodId: '$_id.primPeriod' 
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$salesperson', '$$salespersonId'] },
                    { $eq: ['$primPeriod', '$$periodId'] },
                    { $eq: ['$saleType', 'satis'] }
                  ]
                }
              }
            }
          ],
          as: 'sales'
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
          }
        }
      },
      // Satış bilgilerini kontrol et - satış yoksa gösterme
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
          unpaidAmount: 1
        }
      },
      {
        $sort: { 'primPeriod.year': -1, 'primPeriod.month': -1, 'salesperson.name': 1 }
      }
    ]);

    console.log('✅ Earnings result count:', earnings.length);

    res.json(earnings);
  } catch (error) {
    console.error('Get prim earnings error:', error);
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

module.exports = router;
