# == Schema Information
#
# Table name: category_levels
#
#  id          :uuid             not null, primary key
#  icon        :string
#  name        :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  category_id :uuid             not null
#
# Indexes
#
#  index_category_levels_on_category_id  (category_id)
#
# Foreign Keys
#
#  fk_rails_...  (category_id => categories.id)
#
class CategoryLevel < ApplicationRecord
  belongs_to :category

  delegate :user, to: :category
  delegate :global, to: :category
end
