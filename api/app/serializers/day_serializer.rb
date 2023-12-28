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
class DaySerializer < ActiveModel::Serializer
  attributes :id, :date, :day_type, :order

  belongs_to :cycle

  has_many :factors
end
