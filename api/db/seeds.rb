# # User
# user = User.create!(
#   name: "Test User",
#   info: {
#     average_cycle_length: 28,
#     average_period_length: 4,
#     average_pms_length: 3
#   },
#   settings: {
#     # skateboarding
#   },
#   email: 'test@example.com',
#   password: 'password'
# )

# # Cycle
# cycle = Cycle.create!(user: user)

# # Days: 1-4: period, 5-13: none, 13-18: fertile, 19-25: none, 25-28: pms
# days = (1..28).map do |i|
#   day_type = if i <= 4
#     'period'
#   elsif i <= 13
#     'none'
#   elsif i <= 18
#     'fertile'
#   elsif i <= 25
#     'none'
#   else
#     'pms'
#   end

#   Day.create!(
#     user: user,
#     date: Date.today - (28 - i).days,
#     day_type: day_type,
#     order: i,
#     cycle: cycle
#   )
# end

categories = [
  Category.create!(name: 'Bleeding', icon: 'water', color: '#ff0000', global: true),
  Category.create!(name: 'Spotting', icon: 'water', color: '#ff0000', global: true),
  Category.create!(name: 'Pain', icon: 'water', color: '#ff0000', global: true),
  Category.create!(name: 'Mood', icon: 'water', color: '#ff0000', global: true),
  Category.create!(name: 'Energy', icon: 'water', color: '#ff0000', global: true)
]

category_levels = [
  CategoryLevel.create!(name: 'Light', icon: 'skateboarding', category: categories[0]),
  CategoryLevel.create!(name: 'Medium', icon: 'skateboarding', category: categories[0]),
  CategoryLevel.create!(name: 'Heavy', icon: 'skateboarding', category: categories[0]),

  CategoryLevel.create!(name: 'Red', icon: 'skateboarding', category: categories[1]),
  CategoryLevel.create!(name: 'Brown', icon: 'skateboarding', category: categories[1]),

  CategoryLevel.create!(name: 'Cramps', icon: 'skateboarding', category: categories[2]),
  CategoryLevel.create!(name: 'Headache', icon: 'skateboarding', category: categories[2]),
  CategoryLevel.create!(name: 'Backache', icon: 'skateboarding', category: categories[2]),

  CategoryLevel.create!(name: 'Irritability', icon: 'skateboarding', category: categories[3]),
  CategoryLevel.create!(name: 'Sadness', icon: 'skateboarding', category: categories[3]),
  CategoryLevel.create!(name: 'Anger', icon: 'skateboarding', category: categories[3]),
  CategoryLevel.create!(name: 'Happy', icon: 'skateboarding', category: categories[3]),
  CategoryLevel.create!(name: 'Content', icon: 'skateboarding', category: categories[3]),

  CategoryLevel.create!(name: 'Energetic', icon: 'skateboarding', category: categories[4]),
  CategoryLevel.create!(name: 'Tired', icon: 'skateboarding', category: categories[4]),
  CategoryLevel.create!(name: 'Exhausted', icon: 'skateboarding', category: categories[4])
]
