const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Takım adı gereklidir'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  teamLeader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Takım lideri gereklidir']
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  // Performans metrikleri ayarları
  performanceSettings: {
    // Telefon görüşmesi hedefleri
    phoneCallTarget: {
      type: Number,
      default: 50 // Günlük telefon görüşme hedefi
    },
    // Birebir görüşme hedefleri
    inPersonMeetingTarget: {
      type: Number,
      default: 10 // Günlük birebir görüşme hedefi
    },
    // Satış hedefleri
    salesTarget: {
      type: Number,
      default: 5 // Günlük satış hedefi
    },
    // Başarı kriterleri (conversion rate'ler)
    // Birebir görüşmeden satışa dönüşüm hedefi
    meetingToSalesRatio: {
      type: Number,
      default: 0.5 // %50 - Her 2 birebir görüşmeden 1 satış beklenir
    },
    // Telefon görüşmesinden birebir görüşmeye dönüşüm hedefi
    phoneToMeetingRatio: {
      type: Number,
      default: 0.2 // %20 - Her 5 telefon görüşmesinden 1 birebir görüşme beklenir
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Takım üyelerini eklerken takım liderini otomatik olarak ekle
teamSchema.pre('save', function(next) {
  if (this.teamLeader && !this.members.includes(this.teamLeader)) {
    this.members.push(this.teamLeader);
  }
  next();
});

// Takım performans analizini hesaplama metodu
teamSchema.statics.calculatePerformance = async function(teamId, startDate, endDate) {
  const Team = this;
  const CommunicationRecord = mongoose.model('CommunicationRecord');
  const Sale = mongoose.model('Sale');
  
  const team = await Team.findById(teamId).populate('members teamLeader');
  if (!team) {
    throw new Error('Takım bulunamadı');
  }

  const memberIds = team.members.map(m => m._id);
  
  // İletişim kayıtlarını getir
  const communications = await CommunicationRecord.aggregate([
    {
      $match: {
        user: { $in: memberIds },
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'communicationtypes',
        localField: 'communicationType',
        foreignField: '_id',
        as: 'typeInfo'
      }
    },
    {
      $unwind: '$typeInfo'
    },
    {
      $group: {
        _id: {
          user: '$user',
          type: '$typeInfo.name'
        },
        count: { $sum: 1 }
      }
    }
  ]);

  // Satış kayıtlarını getir
  const sales = await Sale.aggregate([
    {
      $match: {
        salesRep: { $in: memberIds },
        saleDate: { $gte: startDate, $lte: endDate },
        isCancelled: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$salesRep',
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  // Kullanıcı bazında performans hesapla
  const userPerformance = {};
  
  team.members.forEach(member => {
    const userIdStr = member._id.toString();
    userPerformance[userIdStr] = {
      user: {
        _id: member._id,
        name: member.name,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email
      },
      phoneCalls: 0,
      inPersonMeetings: 0,
      otherCommunications: 0,
      totalSales: 0,
      totalRevenue: 0,
      metrics: {}
    };
  });

  // İletişim verilerini doldur
  communications.forEach(comm => {
    const userIdStr = comm._id.user.toString();
    const type = comm._id.type.toLowerCase();
    
    if (userPerformance[userIdStr]) {
      if (type.includes('telefon') || type.includes('arama')) {
        userPerformance[userIdStr].phoneCalls += comm.count;
      } else if (type.includes('birebir') || type.includes('görüşme') || type.includes('ofis')) {
        userPerformance[userIdStr].inPersonMeetings += comm.count;
      } else {
        userPerformance[userIdStr].otherCommunications += comm.count;
      }
    }
  });

  // Satış verilerini doldur
  sales.forEach(sale => {
    const userIdStr = sale._id.toString();
    if (userPerformance[userIdStr]) {
      userPerformance[userIdStr].totalSales = sale.totalSales;
      userPerformance[userIdStr].totalRevenue = sale.totalRevenue;
    }
  });

  // Performans metriklerini hesapla
  Object.keys(userPerformance).forEach(userId => {
    const perf = userPerformance[userId];
    const settings = team.performanceSettings;
    
    // Conversion rate'leri hesapla
    const meetingToSalesActual = perf.inPersonMeetings > 0 
      ? perf.totalSales / perf.inPersonMeetings 
      : 0;
    
    const phoneToMeetingActual = perf.phoneCalls > 0 
      ? perf.inPersonMeetings / perf.phoneCalls 
      : 0;

    // Başarı skorları (0-100 arası)
    const meetingToSalesScore = settings.meetingToSalesRatio > 0
      ? Math.min(100, (meetingToSalesActual / settings.meetingToSalesRatio) * 100)
      : 0;
    
    const phoneToMeetingScore = settings.phoneToMeetingRatio > 0
      ? Math.min(100, (phoneToMeetingActual / settings.phoneToMeetingRatio) * 100)
      : 0;

    // Genel aktivite skoru
    const phoneCallScore = settings.phoneCallTarget > 0
      ? Math.min(100, (perf.phoneCalls / settings.phoneCallTarget) * 100)
      : 0;
    
    const meetingScore = settings.inPersonMeetingTarget > 0
      ? Math.min(100, (perf.inPersonMeetings / settings.inPersonMeetingTarget) * 100)
      : 0;
    
    const salesScore = settings.salesTarget > 0
      ? Math.min(100, (perf.totalSales / settings.salesTarget) * 100)
      : 0;

    // Risk analizi
    let riskLevel = 'Düşük';
    let riskFactors = [];
    
    // Düşük telefon görüşmesi
    if (phoneCallScore < 50) {
      riskFactors.push('Düşük telefon görüşmesi aktivitesi');
    }
    
    // Düşük birebir görüşme
    if (meetingScore < 50) {
      riskFactors.push('Düşük birebir görüşme aktivitesi');
    }
    
    // Düşük dönüşüm oranı (telefon -> birebir)
    if (phoneToMeetingScore < 50 && perf.phoneCalls > 10) {
      riskFactors.push('Telefon görüşmelerinden birebir görüşmeye düşük dönüşüm');
    }
    
    // Düşük dönüşüm oranı (birebir -> satış)
    if (meetingToSalesScore < 50 && perf.inPersonMeetings > 5) {
      riskFactors.push('Birebir görüşmelerden satışa düşük dönüşüm');
    }
    
    // Düşük satış
    if (salesScore < 50) {
      riskFactors.push('Hedef altı satış performansı');
    }

    // Risk seviyesi belirleme
    if (riskFactors.length >= 4) {
      riskLevel = 'Yüksek';
    } else if (riskFactors.length >= 2) {
      riskLevel = 'Orta';
    }

    // Başarı analizi
    let successLevel = 'Orta';
    let successFactors = [];
    
    if (phoneCallScore >= 80) {
      successFactors.push('Yüksek telefon görüşmesi aktivitesi');
    }
    
    if (meetingScore >= 80) {
      successFactors.push('Yüksek birebir görüşme aktivitesi');
    }
    
    if (phoneToMeetingScore >= 80) {
      successFactors.push('Telefon görüşmelerinden birebir görüşmeye yüksek dönüşüm');
    }
    
    if (meetingToSalesScore >= 80) {
      successFactors.push('Birebir görüşmelerden satışa yüksek dönüşüm');
    }
    
    if (salesScore >= 80) {
      successFactors.push('Hedef üstü satış performansı');
    }

    // Başarı seviyesi belirleme
    if (successFactors.length >= 4) {
      successLevel = 'Yüksek';
    } else if (successFactors.length >= 2) {
      successLevel = 'İyi';
    } else if (successFactors.length === 0) {
      successLevel = 'Düşük';
    }

    // Toplam performans skoru (ağırlıklı ortalama)
    // En önemli metrik: Satış (40%)
    // İkinci önemli: Birebir görüşme -> Satış dönüşümü (25%)
    // Üçüncü: Birebir görüşme sayısı (20%)
    // Dördüncü: Telefon -> Birebir dönüşümü (10%)
    // Beşinci: Telefon görüşmesi sayısı (5%)
    const overallScore = (
      salesScore * 0.40 +
      meetingToSalesScore * 0.25 +
      meetingScore * 0.20 +
      phoneToMeetingScore * 0.10 +
      phoneCallScore * 0.05
    );

    perf.metrics = {
      scores: {
        phoneCallScore: Math.round(phoneCallScore),
        meetingScore: Math.round(meetingScore),
        salesScore: Math.round(salesScore),
        phoneToMeetingScore: Math.round(phoneToMeetingScore),
        meetingToSalesScore: Math.round(meetingToSalesScore),
        overallScore: Math.round(overallScore)
      },
      conversionRates: {
        phoneToMeeting: phoneToMeetingActual,
        meetingToSales: meetingToSalesActual,
        phoneToMeetingTarget: settings.phoneToMeetingRatio,
        meetingToSalesTarget: settings.meetingToSalesRatio
      },
      risk: {
        level: riskLevel,
        factors: riskFactors
      },
      success: {
        level: successLevel,
        factors: successFactors
      }
    };
  });

  // Takım geneli istatistikler
  const teamStats = {
    totalMembers: memberIds.length,
    totalPhoneCalls: 0,
    totalMeetings: 0,
    totalSales: 0,
    totalRevenue: 0,
    averageOverallScore: 0
  };

  let scoreSum = 0;
  Object.values(userPerformance).forEach(perf => {
    teamStats.totalPhoneCalls += perf.phoneCalls;
    teamStats.totalMeetings += perf.inPersonMeetings;
    teamStats.totalSales += perf.totalSales;
    teamStats.totalRevenue += perf.totalRevenue;
    scoreSum += perf.metrics.scores.overallScore;
  });

  teamStats.averageOverallScore = Math.round(scoreSum / memberIds.length);

  return {
    team: {
      _id: team._id,
      name: team.name,
      description: team.description,
      teamLeader: team.teamLeader,
      performanceSettings: team.performanceSettings
    },
    dateRange: { startDate, endDate },
    userPerformance,
    teamStats
  };
};

module.exports = mongoose.model('Team', teamSchema);

