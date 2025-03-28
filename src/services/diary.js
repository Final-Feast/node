import Diary from '../db/models/Diary.js';

export const getAllDiary = async (date, userId) => {
  const diary = await Diary.findOne({ date, userId });

  if (!diary) {
    return false;
  }
  return diary;
};

export const addProductDiary = async (
  date,
  user,
  product,
  dailyRate = 2000,
) => {
  const userId = user.id; // kontrol et, gelen veriden id yi nasıl aldığına
  // Daily Rate 10 * ağırlık + 6,25 * boy - 5 * yaş - 161 - 10 * (ağırlık - istenen ağırlık)
  // user dan gelicek ağırlık ve boy bilgileri
  const { currentWeight, height, desiredWeight, age } = user;

  if (currentWeight && height && age && desiredWeight) {
    const weightDiff = Math.max(0, currentWeight - desiredWeight);

    dailyRate =
      10 * currentWeight + 6.25 * height - 5 * age - 161 - 10 * weightDiff;
  }
  console.log('Daily Rate : ', dailyRate);

  const diary = await Diary.findOne({ userId, date });
  if (diary) {
    diary.products.push(product);
    diary.products.filter((s) => s.date == date);
    const totalCalories = diary.products.reduce(
      (sum, p) => sum + p.calories,
      0,
    );
    diary.summary.dailyRate = dailyRate;
    diary.summary.consumed = totalCalories;
    diary.summary.left = dailyRate - totalCalories;
    diary.summary.percentOfDailyRate = (totalCalories / dailyRate) * 100;

    await diary.save();
    return true;
  } else {
    const consumed = product.calories;
    const left = dailyRate - consumed;
    const percentOfDailyRate = (consumed / dailyRate) * 100;

    const newDiary = new Diary({
      userId,
      date,
      products: [product],
      summary: {
        left,
        consumed,
        dailyRate,
        percentOfDailyRate,
      },
    });

    await newDiary.save();
    return true;
  }
};

export const updateProductInDiary = async (userId, entryId, product) => {
  const { title, weight, calories, date } = product;

  const diary = await Diary.findOneAndUpdate(
    { userId, date, 'products._id': entryId },
    {
      $set: {
        'products.$.title': title,
        'products.$.weight': weight,
        'products.$.calories': calories,
      },
    },
    { new: true },
  );

  if (!diary) {
    throw new Error('Ürün veya günlük kaydı bulunamadı!');
  }

  const totalCalories = diary.products.reduce((sum, p) => sum + p.calories, 0);
  diary.summary.consumed = totalCalories;
  diary.summary.left = diary.summary.dailyRate - totalCalories;
  diary.summary.percentOfDailyRate =
    (totalCalories / diary.summary.dailyRate) * 100;

  await diary.save();
  return diary;
};

export const deleteProductDiary = async (user, date, productId) => {
  const userId = user.id;
  const { currentWeight, height, desiredWeight, age } = user;

  const result = await Diary.updateOne(
    { userId, date },
    { $pull: { products: { _id: productId } } },
  );

  if (result.modifiedCount === 0) {
    return {
      success: false,
      data: null,
    };
  }

  const diary = await Diary.findOne({ userId, date });

  if (diary.products.length === 0) {
    await Diary.deleteOne({ userId, date });
    return { success: true, data: null };
  }
  let dailyRate = 2000; // Default olarak atadım
  if (currentWeight && height && desiredWeight && age) {
    const weightDiff = Math.max(0, currentWeight - desiredWeight);
    dailyRate =
      10 * currentWeight + 6.25 * height - 5 * age - 161 - 10 * weightDiff;
  }
  const totalCalories = diary.products.reduce((sum, p) => sum + p.calories, 0);
  diary.summary.dailyRate = dailyRate;
  diary.summary.consumed = totalCalories;
  diary.summary.left = dailyRate - totalCalories;
  diary.summary.percentOfDailyRate = (totalCalories / dailyRate) * 100;
  diary.save();
  return {
    success: true,
    data: { products: diary.products, summary: diary.summary },
  };
};
