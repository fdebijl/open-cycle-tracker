# == Schema Information
#
# Table name: factors
#
#  id                :uuid             not null, primary key
#  notes             :string
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  category_level_id :uuid             not null
#  day_id            :uuid             not null
#  user_id           :uuid             not null
#
# Indexes
#
#  index_factors_on_category_level_id  (category_level_id)
#  index_factors_on_day_id             (day_id)
#  index_factors_on_user_id            (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (category_level_id => category_levels.id)
#  fk_rails_...  (day_id => days.id)
#  fk_rails_...  (user_id => users.id)
#
class Factor < ApplicationRecord
  # Factors describe the user experience of a day, as they relate to a category.
  # Currently users can only pick from pre-set levels in a category, but in the future
  # users can define their own categories and levels, as well as add numerical values (for weight, basal body temp)
  # and notes to describe their experience.

  belongs_to :day
  belongs_to :category_level
end
