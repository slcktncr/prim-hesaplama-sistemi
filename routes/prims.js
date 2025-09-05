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
      // Kesinti transaction'larını da getir (tüm dönemlerden)
      {
        $lookup: {
          from: 'primtransactions',
          let: { salespersonId: '$_id.salesperson' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$salesperson', '$$salespersonId'] },
                    { $eq: ['$transactionType', 'kesinti'] }
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
              $addFields: {
                saleDetails: { $arrayElemAt: ['$saleDetails', 0] }
              }
            }
          ],
          as: 'deductionTransactions'
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
          deductionsCount: { $size: '$deductionTransactions' }
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
          deductionTransactions: 1
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

module.exports = router;
