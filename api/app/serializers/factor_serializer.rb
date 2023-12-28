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
class FactorSerializer < ActiveModel::Serializer
  attributes :id, :notes

  belongs_to :day
  belongs_to :category_level
end
