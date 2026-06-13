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
#  user_id    :uuid
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
  # Categories can be global, meaning they are available to all users, or they can be specific to a user.
  #
  # TODO: Possible addition: Add cycle_starting boolean so a category can be set to start a new cycle when it's added to a factor
  # For the MVP we can just ask the user to manually start a new cycle when they register non-consecutive bleeding

  belongs_to :user, optional: true

  has_many :category_levels, dependent: :destroy

  validates :user, presence: true, unless: :global

  # validates :name, presence: true
  # validates :color, presence: true
end
