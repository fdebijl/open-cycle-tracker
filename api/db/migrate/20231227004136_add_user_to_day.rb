class AddUserToDay < ActiveRecord::Migration[7.0]
  def change
    add_reference :days, :user, type: :uuid, null: false, foreign_key: true
  end
end
