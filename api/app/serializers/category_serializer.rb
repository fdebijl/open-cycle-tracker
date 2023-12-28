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
class CategorySerializer < ActiveModel::Serializer
  attributes :id, :icon, :name, :color, :global
end
