# == Schema Information
#
# Table name: categories
#
#  id         :uuid             not null, primary key
#  color      :string
#  global     :boolean          default(FALSE)
#  icon       :string
#  name       :string
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :uuid             not null
#
# Indexes
#
#  index_categories_on_user_id  (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#
class Category < ApplicationRecord
  # A category within OCT refers to a category of symptoms someone may experience during their cycle,
  # or some other aspect relating to their cycle they wish to track.
  # Examples include bleeding, pain, mood, energy, weight, basal body temperature, etc.

  belongs_to :user

  has_many :category_levels, dependent: :destroy

  # validates :name, presence: true
  # validates :color, presence: true
end
