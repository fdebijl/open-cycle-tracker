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
#
# Indexes
#
#  index_days_on_cycle_id  (cycle_id)
#  index_days_on_date      (date) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (cycle_id => cycles.id)
#
require "test_helper"

class DayTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
