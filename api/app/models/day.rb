# == Schema Information
#
# Table name: days
#
#  id         :uuid             not null, primary key
#  date       :datetime
#  day_type   :string
#  order      :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  cycle_id   :uuid             not null
#  user_id    :uuid             not null
#
# Indexes
#
#  index_days_on_cycle_id  (cycle_id)
#  index_days_on_date      (date) UNIQUE
#  index_days_on_user_id   (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (cycle_id => cycles.id)
#  fk_rails_...  (user_id => users.id)
#
class Day < ApplicationRecord
  belongs_to :user
  belongs_to :cycle

  validates :day_type, inclusion: { in: %w[none period fertile ovulation pms] }

  has_many :factors, dependent: :destroy

  def is_today?
    today = Date.today
    self.date.day == today.day &&
      self.date.month == today.month &&
      self.date.year == today.year
  end
end
