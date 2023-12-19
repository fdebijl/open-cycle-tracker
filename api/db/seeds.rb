# User
user = User.create!(
  name: "Test User",
  info: {
    average_cycle_length: 28,
    average_period_length: 4,
    average_pms_length: 3
  },
  settings: {
    # TBD
  }
)

# Cycle
cycle = Cycle.create!(user: user)

# Days: 1-4: period, 5-13: none, 13-18: fertile, 19-25: none, 25-28: pms
days = (1..28).map do |i|
  day_type = if i <= 4
    'period'
  elsif i <= 13
    'none'
  elsif i <= 18
    'fertile'
  elsif i <= 25
    'none'
  else
    'pms'
  end

  Day.create!(
    date: Date.today - (28 - i).days,
    day_type: day_type,
    order: i,
    cycle: cycle
  )
end
