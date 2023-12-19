# == Schema Information
#
# Table name: cycles
#
#  id         :uuid             not null, primary key
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :uuid             not null
#
# Indexes
#
#  index_cycles_on_user_id  (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#
class Cycle < ApplicationRecord
  belongs_to :user

  has_many :days, dependent: :destroy

  def start_date
    self.days.order(:date).first.date
  end

  def end_date
    self.days.order(:date).last.date
  end
end
